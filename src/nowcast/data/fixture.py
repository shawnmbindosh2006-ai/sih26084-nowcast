"""Deterministic, geographically unlocated integration fixture, version 1."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def generate_fixture(directory: str | Path) -> Path:
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=False)
    # Integer arithmetic followed by exact float conversion avoids RNG/version drift.
    t, y, x = np.indices((16, 32, 32))
    frames = ((x + 2*y + 3*t) % 64).astype("<f4")[..., None]
    mask = np.ones((12, 32, 32, 1), dtype=bool)
    mask[:, 0, 0, :] = False
    observed = frames[:12].copy()
    observed[~mask] = 0  # Deliberate synthetic missing cell; not an observed zero.
    np.save(root / "observed.npy", observed, allow_pickle=False)
    np.save(root / "quality-mask.npy", mask, allow_pickle=False)
    np.save(root / "evaluation-targets.npy", frames[12:], allow_pickle=False)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    times = [(start + timedelta(minutes=5*i)).isoformat().replace("+00:00", "Z") for i in range(16)]
    event = {
        "schema_version": "1.0", "event_id": "synthetic-demo-001", "mode": "synthetic",
        "event_time_utc": times[11], "timestamps_utc": times[:12],
        "observed_array_path": "observed.npy", "quality_mask_path": "quality-mask.npy",
        "channel_names": ["demo_intensity"], "channel_units": ["arbitrary_demo_units"],
        "sources": [{"id": "fixture-v1", "availability": "synthetic",
                     "provenance": "Deterministic arithmetic pattern; synthetic values and UTC dates; no real geography or weather observations."}],
        "grid": {"native_spacing_km": None, "effective_spacing_km": None,
                 "crs": None, "bounds_wgs84": None}}
    write_json(root / "event.json", event)
    write_json(root / "evaluation.json", {"event_id": event["event_id"], "mode": "synthetic",
               "target_array_path": "evaluation-targets.npy", "timestamps_utc": times[12:]})
    write_json(root / "provenance.json", {
        "generator": "nowcast.data.fixture:v1", "orientation": "T,row,column,C; image view only",
        "mask": "boolean True=valid, False=missing; no imputation",
        "normalization": None, "resampling": None, "checkpoint": None,
        "files": {p.name: {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size}
                  for p in sorted(root.iterdir())}})
    return root / "event.json"
