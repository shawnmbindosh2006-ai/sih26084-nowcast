"""Validate observed-only EventBundle metadata and local NumPy artifacts."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

EventBundle = dict[str, Any]


class EventValidationError(ValueError):
    """An input cannot be consumed without inventing or repairing information."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise EventValidationError(message)


def utc(value: str) -> datetime:
    require(isinstance(value, str) and "T" in value, "timestamp must be ISO UTC")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EventValidationError("malformed timestamp") from exc
    require(result.tzinfo is not None and result.utcoffset() == timedelta(0),
            "timestamp must have explicit UTC offset")
    return result


def artifact(root: Path, value: str) -> Path:
    require(isinstance(value, str) and bool(value.strip()), "array path is required")
    path = (root / value).resolve()
    require(path.is_relative_to(root), "array must remain inside event directory")
    require(path.suffix == ".npy", "artifact must be a single .npy array")
    return path


def load_event(path: str | Path, *, expected_channels: dict[str, str] | None = None,
               expected_cadence_seconds: float | None = None) -> EventBundle:
    """Return contract metadata with absolute observed/mask paths.

    Only these two arrays are opened. Evaluation metadata belongs in another
    JSON file and unknown fields are not forwarded to inference. Masks are
    boolean: True means valid; False means missing/invalid. No imputation occurs.
    Expected channels can constrain a consumer beyond the known demo/VIL units.
    """
    path = Path(path).resolve()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        require(isinstance(raw, dict), "metadata must be an object")
        fields = ("schema_version", "event_id", "mode", "sources", "event_time_utc",
                  "timestamps_utc", "observed_array_path", "channel_names",
                  "channel_units", "quality_mask_path", "grid")
        require(all(k in raw for k in fields), "missing required EventBundle field")
        event = {k: raw[k] for k in fields}
        require(event["schema_version"] == "1.0", "unsupported schema_version")
        require(isinstance(event["event_id"], str) and bool(event["event_id"].strip()),
                "event_id must be nonempty")
        require(event["mode"] in ("synthetic", "replay", "live"), "invalid mode")
        sources = event["sources"]
        require(isinstance(sources, list) and bool(sources), "sources must be nonempty")
        for source in sources:
            require(isinstance(source, dict) and all(source.get(k) for k in
                    ("id", "availability", "provenance")), "source provenance is required")
            require(source["availability"] != "synthetic" or event["mode"] == "synthetic",
                    "synthetic source cannot be replay/live")
        observed_path = artifact(path.parent, event["observed_array_path"])
        observed = np.load(observed_path, allow_pickle=False, mmap_mode="r")
        require(observed.ndim == 4 and all(observed.shape), "expected nonempty [T,H,W,C]")
        require(observed.dtype.kind in "uif", "observed array must be real numeric")
        times = event["timestamps_utc"]
        require(isinstance(times, list) and len(times) == observed.shape[0], "timestamp count differs from T")
        parsed = [utc(t) for t in times]
        gaps = [(b-a).total_seconds() for a, b in zip(parsed, parsed[1:])]
        require(all(g > 0 for g in gaps), "timestamps must be strictly increasing")
        cadence = expected_cadence_seconds
        allowed_jitter_seconds = 0.0
        if cadence is not None:
            require(np.isfinite(cadence) and cadence > 0, "cadence must be positive")
        elif gaps:
            cadence = float(np.median(gaps))
            allowed_jitter_seconds = 30.0
        require(all(abs(g - cadence) <= allowed_jitter_seconds for g in gaps),
                "cadence gap; no implicit interpolation")
        require(utc(event["event_time_utc"]) == parsed[-1], "event_time_utc must be last observation")
        names, units = event["channel_names"], event["channel_units"]
        require(isinstance(names, list) and isinstance(units, list) and
                len(names) == len(units) == observed.shape[3], "missing channel or unit")
        require(all(isinstance(v, str) and bool(v.strip()) for v in names + units), "empty channel/unit")
        require(len(set(names)) == len(names), "duplicate channel")
        known = {"demo_intensity": "arbitrary_demo_units", "vil": "SEVIR_encoded_VIL",
                 "reflectivity": "dBZ"}
        for name, unit in zip(names, units):
            require(name not in known or unit == known[name], f"incompatible units for {name}")
        require("demo_intensity" not in names or event["mode"] == "synthetic", "demo channel requires synthetic mode")
        if expected_channels is not None:
            require(dict(zip(names, units)) == expected_channels, "required channels/units differ")
        mask_path = event["quality_mask_path"]
        valid = np.ones(observed.shape, dtype=bool)
        if mask_path is not None:
            resolved = artifact(path.parent, mask_path)
            mask = np.load(resolved, allow_pickle=False, mmap_mode="r")
            require(mask.dtype == np.bool_, "mask must be boolean; True means valid")
            require(mask.shape in (observed.shape[:3], (*observed.shape[:3], 1), observed.shape), "mask dimensions differ")
            valid = np.broadcast_to(mask[..., None] if mask.ndim == 3 else mask, observed.shape)
            event["quality_mask_path"] = str(resolved)
        require(bool(np.isfinite(observed[valid]).all()), "nonfinite value at valid pixel")
        if "vil" in names:
            values = observed[..., names.index("vil")][valid[..., names.index("vil")]]
            require(bool(((values >= 0) & (values <= 254) & (values == np.floor(values))).all()),
                    "encoded VIL must be 0..254; 255 must be masked missing")
        grid = event["grid"]
        require(isinstance(grid, dict) and all(k in grid for k in
                ("native_spacing_km", "effective_spacing_km", "crs", "bounds_wgs84")), "incomplete grid")
        for key in ("native_spacing_km", "effective_spacing_km"):
            value = grid[key]
            require(value is None or (isinstance(value, (int, float)) and not isinstance(value, bool)
                    and np.isfinite(value) and value > 0), "invalid grid spacing")
        require(grid["crs"] is None or (isinstance(grid["crs"], str) and bool(grid["crs"].strip())), "invalid CRS")
        bounds = grid["bounds_wgs84"]
        if bounds is not None:
            require(isinstance(bounds, list) and len(bounds) == 4 and all(
                isinstance(v, (int, float)) and not isinstance(v, bool) and np.isfinite(v) for v in bounds), "invalid bounds")
            west, south, east, north = bounds
            require(-180 <= west < east <= 180 and -90 <= south < north <= 90, "invalid bounds ordering")
        if grid["native_spacing_km"] != grid["effective_spacing_km"]:
            record = grid.get("resampling")
            require(isinstance(record, dict) and bool(record.get("method")) and
                    record.get("source_spacing_km") == grid["native_spacing_km"], "resampling provenance required")
        event["observed_array_path"] = str(observed_path)
        return event
    except (OSError, TypeError, KeyError, ValueError) as exc:
        if isinstance(exc, EventValidationError):
            raise
        raise EventValidationError(f"invalid event: {exc}") from exc
