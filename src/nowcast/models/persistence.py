"""CPU persistence baseline for ForecastBundle contract version 1.

This module deliberately reads only ``observed_array_path``. Evaluation target
paths are not accepted as model inputs and are never inspected by ``predict``.
"""

from __future__ import annotations

import copy
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np


DEFAULT_SUPPORTED_LEAD_TIMES_MINUTES = tuple(range(5, 61, 5))
_VALID_MODES = {"synthetic", "replay", "live"}


class EventValidationError(ValueError):
    """Raised when an EventBundle cannot safely be used for prediction."""


class UnsupportedLeadTimeError(ValueError):
    """Raised when a requested lead is outside the adapter's declared horizon."""


def _parse_utc(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise EventValidationError(f"{field_name} must be an ISO-8601 UTC string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EventValidationError(f"{field_name} is not a valid ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise EventValidationError(f"{field_name} must include an explicit UTC offset")
    return parsed.astimezone(timezone.utc)


def _format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _empty_zones() -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


def _unavailable_hazard(name: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "probability": None,
        "units": None,
        "method": "not_assessed_by_persistence",
        "reason": f"{name} is not calibrated or assessed by the persistence baseline",
        "zones": _empty_zones(),
        "estimated_arrival_utc": None,
        "timing_uncertainty_minutes": None,
    }


@dataclass(frozen=True)
class ValidatedEvent:
    event: Mapping[str, Any]
    observed: np.ndarray
    event_time: datetime


class PersistenceNowcaster:
    """Repeat the final observed frame for each supported requested lead."""

    def __init__(
        self,
        artifact_root: str | os.PathLike[str] = "runs",
        supported_lead_times_minutes: Sequence[int] = DEFAULT_SUPPORTED_LEAD_TIMES_MINUTES,
    ) -> None:
        supported = tuple(int(value) for value in supported_lead_times_minutes)
        if not supported or any(value <= 0 for value in supported):
            raise ValueError("supported lead times must contain positive integers")
        if tuple(sorted(set(supported))) != supported:
            raise ValueError("supported lead times must be unique and strictly increasing")
        self.artifact_root = Path(artifact_root)
        self.supported_lead_times_minutes = supported

    def _validate_event(self, event: Mapping[str, Any]) -> ValidatedEvent:
        if not isinstance(event, Mapping):
            raise EventValidationError("event must be a mapping")
        if event.get("schema_version") != "1.0":
            raise EventValidationError("schema_version must be '1.0'")
        if not isinstance(event.get("event_id"), str) or not event["event_id"].strip():
            raise EventValidationError("event_id must be a non-empty string")
        if event.get("mode") not in _VALID_MODES:
            raise EventValidationError("mode must be synthetic, replay, or live")

        raw_path = event.get("observed_array_path")
        if not isinstance(raw_path, str) or not raw_path.strip():
            raise EventValidationError(
                "observed_array_path is required; metadata-only fixtures cannot run inference"
            )
        observed_path = Path(raw_path)
        if not observed_path.is_file():
            raise EventValidationError(f"observed array does not exist: {observed_path}")
        try:
            observed = np.load(observed_path, allow_pickle=False)
        except (OSError, ValueError) as exc:
            raise EventValidationError(f"observed array could not be loaded: {observed_path}") from exc
        if not isinstance(observed, np.ndarray):
            raise EventValidationError("observed_array_path must identify one NumPy array")
        if observed.ndim != 4:
            raise EventValidationError("observed array must have shape [T,H,W,C]")
        if any(size <= 0 for size in observed.shape):
            raise EventValidationError("observed array dimensions must all be non-zero")
        if not np.issubdtype(observed.dtype, np.number):
            raise EventValidationError("observed array must have a numeric dtype")

        timestamps = event.get("timestamps_utc")
        if not isinstance(timestamps, list) or len(timestamps) != observed.shape[0]:
            raise EventValidationError("timestamps_utc length must equal observed array T")
        parsed_timestamps = [
            _parse_utc(value, f"timestamps_utc[{index}]")
            for index, value in enumerate(timestamps)
        ]
        if any(current >= following for current, following in zip(parsed_timestamps, parsed_timestamps[1:])):
            raise EventValidationError("timestamps_utc must be strictly increasing")

        event_time = _parse_utc(event.get("event_time_utc"), "event_time_utc")
        if parsed_timestamps[-1] != event_time:
            raise EventValidationError("event_time_utc must equal the final observed timestamp")

        channel_names = event.get("channel_names")
        channel_units = event.get("channel_units")
        channel_count = observed.shape[3]
        if not isinstance(channel_names, list) or len(channel_names) != channel_count:
            raise EventValidationError("channel_names length must equal observed array C")
        if not isinstance(channel_units, list) or len(channel_units) != channel_count:
            raise EventValidationError("channel_units length must equal observed array C")
        if any(not isinstance(value, str) or not value for value in channel_names):
            raise EventValidationError("channel_names must contain non-empty strings")
        if any(not isinstance(value, str) or not value for value in channel_units):
            raise EventValidationError("channel_units must contain non-empty strings")

        if not isinstance(event.get("grid"), Mapping):
            raise EventValidationError("grid must be an object")
        sources = event.get("sources")
        if not isinstance(sources, list):
            raise EventValidationError("sources must be an array")

        quality_mask_path = event.get("quality_mask_path")
        if quality_mask_path is not None:
            if not isinstance(quality_mask_path, str) or not Path(quality_mask_path).is_file():
                raise EventValidationError("quality_mask_path must be null or an existing file")
            try:
                quality_mask = np.load(quality_mask_path, allow_pickle=False)
            except (OSError, ValueError) as exc:
                raise EventValidationError("quality mask could not be loaded") from exc
            if quality_mask.shape not in {
                observed.shape[:3],
                (*observed.shape[:3], 1),
                observed.shape,
            }:
                raise EventValidationError(
                    "quality mask must match [T,H,W], [T,H,W,1], or [T,H,W,C]"
                )

        return ValidatedEvent(event=event, observed=observed, event_time=event_time)

    def _validate_lead_times(self, lead_times: Sequence[int]) -> tuple[int, ...]:
        if isinstance(lead_times, (str, bytes)):
            raise UnsupportedLeadTimeError("lead_times must be a sequence of integers")
        requested = tuple(lead_times)
        if not requested:
            raise UnsupportedLeadTimeError("at least one lead time is required")
        if any(isinstance(value, bool) or not isinstance(value, int) for value in requested):
            raise UnsupportedLeadTimeError("lead times must be integers")
        if tuple(sorted(set(requested))) != requested:
            raise UnsupportedLeadTimeError("lead times must be unique and strictly increasing")
        unsupported = [
            value for value in requested if value not in self.supported_lead_times_minutes
        ]
        if unsupported:
            raise UnsupportedLeadTimeError(
                "unsupported lead times: "
                f"{unsupported}; supported={list(self.supported_lead_times_minutes)}"
            )
        return requested

    def predict(self, event: Mapping[str, Any], lead_times: Sequence[int]) -> dict[str, Any]:
        validated = self._validate_event(event)
        requested_leads = self._validate_lead_times(lead_times)
        run_id = f"persistence-{uuid.uuid4().hex}"
        run_directory = self.artifact_root / run_id
        run_directory.mkdir(parents=True, exist_ok=False)

        final_observation = np.asarray(validated.observed[-1])
        frames: list[dict[str, Any]] = []
        for lead_minutes in requested_leads:
            valid_time = validated.event_time + timedelta(minutes=lead_minutes)
            for channel_index, (variable, units) in enumerate(
                zip(event["channel_names"], event["channel_units"])
            ):
                filename = f"lead-{lead_minutes:03d}-channel-{channel_index:02d}.npy"
                np.save(run_directory / filename, final_observation[..., channel_index])
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
            "CPU persistence baseline: every forecast frame repeats the final observation.",
            "This is not learned AI inference and provides no calibrated hazard probabilities.",
        ]
        if event["mode"] == "synthetic":
            warnings.append(
                "Synthetic output is pipeline evidence only, not weather-skill evidence."
            )

        return {
            "schema_version": "1.0",
            "run_id": run_id,
            "event_id": event["event_id"],
            "mode": event["mode"],
            "forecast_method": "persistence",
            "issued_at_utc": _format_utc(datetime.now(timezone.utc)),
            "event_time_utc": _format_utc(validated.event_time),
            "supported_lead_times_minutes": list(self.supported_lead_times_minutes),
            "sources": copy.deepcopy(event["sources"]),
            "model": {
                "id": "cpu-persistence",
                "version": "1.0",
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


def predict(event: Mapping[str, Any], lead_times: Sequence[int]) -> dict[str, Any]:
    """Shared two-argument persistence interface using ``NOWCAST_ARTIFACT_DIR``."""

    artifact_root = os.environ.get("NOWCAST_ARTIFACT_DIR", "runs")
    return PersistenceNowcaster(artifact_root=artifact_root).predict(event, lead_times)
