"""Observed-only Lucas--Kanade optical-flow nowcasting.

The provider deliberately accepts the same EventBundle mapping as the
persistence baseline and reads only ``observed_array_path`` and the optional
quality mask.  Evaluation targets are not part of the provider interface.
"""

from __future__ import annotations

import copy
import importlib.metadata
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

import numpy as np

from .persistence import (
    EventValidationError,
    PersistenceNowcaster,
    UnsupportedLeadTimeError,
    _format_utc,
    _parse_utc,
)


OPTICAL_FLOW_SUPPORTED_LEAD_TIMES_MINUTES = (30, 60)
DEFAULT_HISTORY_FRAMES = 3


class OpticalFlowRuntimeError(RuntimeError):
    """Raised when the pySTEPS motion/extrapolation runtime cannot forecast."""


def _empty_zones() -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


def _unavailable_hazard(name: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "probability": None,
        "units": None,
        "method": "not_assessed_by_optical_flow",
        "reason": f"{name} is not calibrated or assessed by optical-flow advection",
        "zones": _empty_zones(),
        "estimated_arrival_utc": None,
        "timing_uncertainty_minutes": None,
    }


def _load_pysteps() -> tuple[str, Callable[..., np.ndarray], Callable[..., np.ndarray]]:
    """Load the exact pySTEPS APIs lazily so persistence remains dependency-free."""

    try:
        from pysteps.extrapolation.semilagrangian import extrapolate
        from pysteps.motion.lucaskanade import dense_lucaskanade
    except ImportError as exc:
        raise OpticalFlowRuntimeError(
            "pySTEPS is required for optical-flow forecasts; install the pinned "
            "model environment described in docs/OPTICAL_FLOW.md"
        ) from exc
    try:
        version = importlib.metadata.version("pysteps")
    except importlib.metadata.PackageNotFoundError as exc:
        raise OpticalFlowRuntimeError("the installed pySTEPS version cannot be verified") from exc
    return version, dense_lucaskanade, extrapolate


def _broadcast_quality_mask(
    quality_mask: np.ndarray | None, observed_shape: tuple[int, ...]
) -> np.ndarray:
    if quality_mask is None:
        return np.ones(observed_shape, dtype=bool)
    expanded = quality_mask
    if expanded.ndim == 3:
        expanded = expanded[..., None]
    return np.broadcast_to(expanded, observed_shape)


class OpticalFlowNowcaster:
    """Advect the final observation using pySTEPS Lucas--Kanade motion.

    Motion is estimated independently for each channel from the most recent
    observed frames.  A second semilagrangian pass advects the boolean validity
    field so missing and out-of-domain pixels stay explicitly invalid.
    """

    def __init__(
        self,
        artifact_root: str | os.PathLike[str] = "runs",
        supported_lead_times_minutes: Sequence[int] = (
            OPTICAL_FLOW_SUPPORTED_LEAD_TIMES_MINUTES
        ),
        history_frames: int = DEFAULT_HISTORY_FRAMES,
    ) -> None:
        if isinstance(history_frames, bool) or not isinstance(history_frames, int):
            raise ValueError("history_frames must be an integer")
        if history_frames < 2:
            raise ValueError("history_frames must be at least 2")
        self.artifact_root = Path(artifact_root)
        self.history_frames = history_frames
        self._validator = PersistenceNowcaster(
            artifact_root=artifact_root,
            supported_lead_times_minutes=supported_lead_times_minutes,
        )
        self.supported_lead_times_minutes = self._validator.supported_lead_times_minutes

    @staticmethod
    def _cadence_minutes(event: Mapping[str, Any]) -> float:
        parsed = [
            _parse_utc(value, f"timestamps_utc[{index}]")
            for index, value in enumerate(event["timestamps_utc"])
        ]
        if len(parsed) < 2:
            raise EventValidationError("optical flow requires at least two observed frames")
        gaps = [
            (following - current).total_seconds() / 60.0
            for current, following in zip(parsed, parsed[1:])
        ]
        if gaps[0] <= 0 or not np.allclose(gaps, gaps[0], rtol=0.0, atol=1e-9):
            raise EventValidationError(
                "optical flow requires a positive, uniform observation cadence"
            )
        return gaps[0]

    @staticmethod
    def _advect_channel(
        history: np.ndarray,
        valid_history: np.ndarray,
        lead_steps: Sequence[float],
        motion_estimator: Callable[..., np.ndarray],
        extrapolator: Callable[..., np.ndarray],
    ) -> tuple[np.ndarray, np.ndarray]:
        motion_input = np.ma.array(history, mask=~valid_history, copy=False)
        try:
            velocity = np.asarray(motion_estimator(motion_input, verbose=False))
        except Exception as exc:  # pySTEPS exposes backend-specific exception types
            raise OpticalFlowRuntimeError("Lucas--Kanade motion estimation failed") from exc
        expected_velocity_shape = (2, *history.shape[1:])
        if velocity.shape != expected_velocity_shape or not np.isfinite(velocity).all():
            raise OpticalFlowRuntimeError(
                f"Lucas--Kanade returned invalid velocity shape/content: {velocity.shape}"
            )

        final_field = np.asarray(history[-1], dtype=np.float32).copy()
        final_field[~valid_history[-1]] = np.nan
        try:
            forecast = np.asarray(
                extrapolator(
                    final_field,
                    velocity,
                    list(lead_steps),
                    outval=np.nan,
                    allow_nonfinite_values=True,
                    interp_order=1,
                ),
                dtype=np.float32,
            )
            validity = np.asarray(
                extrapolator(
                    valid_history[-1].astype(np.float32),
                    velocity,
                    list(lead_steps),
                    outval=0.0,
                    allow_nonfinite_values=False,
                    interp_order=0,
                )
            ) >= 0.5
        except Exception as exc:  # pySTEPS exposes backend-specific exception types
            raise OpticalFlowRuntimeError("semilagrangian extrapolation failed") from exc

        expected_forecast_shape = (len(lead_steps), *history.shape[1:])
        if forecast.shape != expected_forecast_shape or validity.shape != expected_forecast_shape:
            raise OpticalFlowRuntimeError("semilagrangian extrapolation returned an invalid shape")
        validity &= np.isfinite(forecast)
        forecast[~validity] = np.nan
        return forecast, velocity

    def predict(self, event: Mapping[str, Any], lead_times: Sequence[int]) -> dict[str, Any]:
        validated = self._validator._validate_event(event)
        requested_leads = self._validator._validate_lead_times(lead_times)
        cadence_minutes = self._cadence_minutes(event)
        history_count = min(self.history_frames, validated.observed.shape[0])
        if history_count < 2:
            raise EventValidationError("optical flow requires at least two observed frames")

        pysteps_version, motion_estimator, extrapolator = _load_pysteps()
        observed = np.asarray(validated.observed[-history_count:])
        valid = _broadcast_quality_mask(validated.quality_mask, validated.observed.shape)
        valid = np.asarray(valid[-history_count:]) & np.isfinite(observed)
        lead_steps = [lead / cadence_minutes for lead in requested_leads]

        channel_forecasts: list[np.ndarray] = []
        zero_motion_channels: list[str] = []
        for channel_index, channel_name in enumerate(event["channel_names"]):
            forecast, velocity = self._advect_channel(
                np.asarray(observed[..., channel_index], dtype=np.float32),
                valid[..., channel_index],
                lead_steps,
                motion_estimator,
                extrapolator,
            )
            channel_forecasts.append(forecast)
            if np.allclose(velocity, 0.0):
                zero_motion_channels.append(channel_name)

        run_id = f"optical-flow-{uuid.uuid4().hex}"
        run_directory = self.artifact_root / run_id
        run_directory.mkdir(parents=True, exist_ok=False)
        frames: list[dict[str, Any]] = []
        for lead_index, lead_minutes in enumerate(requested_leads):
            valid_time = validated.event_time + timedelta(minutes=lead_minutes)
            for channel_index, (variable, units) in enumerate(
                zip(event["channel_names"], event["channel_units"])
            ):
                filename = f"lead-{lead_minutes:03d}-channel-{channel_index:02d}.npy"
                np.save(run_directory / filename, channel_forecasts[channel_index][lead_index])
                frames.append(
                    {
                        "lead_minutes": lead_minutes,
                        "valid_time_utc": _format_utc(valid_time),
                        "image_url": f"/api/v1/artifacts/{run_id}/{filename}",
                        "variable": variable,
                        "units": units,
                    }
                )

        warnings = [
            "Deterministic Lucas--Kanade optical-flow advection; no learned AI inference is used.",
            "Input variables and units are preserved without rain-rate conversion.",
            "Optical flow advects existing structure and does not model convective growth or decay.",
            "Quality-mask True means valid; invalid or out-of-domain pixels are NaN.",
        ]
        if zero_motion_channels:
            warnings.append(
                "Lucas--Kanade detected zero motion for channel(s): "
                + ", ".join(zero_motion_channels)
                + "."
            )
        if event["mode"] == "synthetic":
            warnings.append("Synthetic output is pipeline evidence only, not weather-skill evidence.")

        return {
            "schema_version": "1.0",
            "run_id": run_id,
            "event_id": event["event_id"],
            "mode": event["mode"],
            "forecast_method": "optical_flow",
            "issued_at_utc": _format_utc(datetime.now(timezone.utc)),
            "event_time_utc": _format_utc(validated.event_time),
            "supported_lead_times_minutes": list(self.supported_lead_times_minutes),
            "sources": copy.deepcopy(event["sources"]),
            "model": {
                "id": "pysteps-lucas-kanade-semilagrangian",
                "version": pysteps_version,
                "checkpoint_sha256": None,
            },
            "grid": copy.deepcopy(event["grid"]),
            "frames": frames,
            "hazards": {
                name: _unavailable_hazard(name)
                for name in (
                    "storm_intensity_proxy",
                    "hail",
                    "lightning",
                    "downburst",
                    "cloudburst",
                )
            },
            "warnings": warnings,
        }


class OpticalFlowPersistenceRouter:
    """Prefer optical flow and fall back honestly on runtime failure only."""

    def __init__(
        self,
        optical_flow: OpticalFlowNowcaster,
        persistence: PersistenceNowcaster,
    ) -> None:
        self.optical_flow = optical_flow
        self.persistence = persistence

    def predict(self, event: Mapping[str, Any], lead_times: Sequence[int]) -> dict[str, Any]:
        try:
            return self.optical_flow.predict(event, lead_times)
        except OpticalFlowRuntimeError as exc:
            fallback = self.persistence.predict(event, lead_times)
            fallback["warnings"].append(
                f"Optical-flow runtime failed; routed to persistence fallback: {exc}"
            )
            return fallback


__all__ = [
    "DEFAULT_HISTORY_FRAMES",
    "OPTICAL_FLOW_SUPPORTED_LEAD_TIMES_MINUTES",
    "OpticalFlowNowcaster",
    "OpticalFlowPersistenceRouter",
    "OpticalFlowRuntimeError",
]
