"""FastAPI fixture demo. Outputs are illustrative and are not weather forecasts."""

from __future__ import annotations

import json
import os
import re
import struct
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from nowcast.hazards.assessment import assess_hazards, empty_zones

ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = ROOT / "fixtures" / "demo-event.json"
RUNS_DIR = Path(os.environ.get("NOWCAST_RUNS_DIR", str(ROOT / "runs"))).resolve()
ALLOWED_LEADS = {15}
ARTIFACT_NAME = "illustrative-frame.png"
RUN_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def _load_fixture() -> dict:
    try:
        return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="The demonstration fixture is unavailable or invalid.") from exc


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def _write_illustrative_png(path: Path) -> None:
    """Write a small neutral PNG; it encodes no meteorological field."""
    width, height = 320, 180
    scanlines = b"".join(b"\x00" + bytes((31, 49, 67)) * width for _ in range(height))
    data = (b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0))
            + _png_chunk(b"tEXt", b"Description\x00Illustrative placeholder; no weather observations or forecast values")
            + _png_chunk(b"IDAT", zlib.compress(scanlines)) + _png_chunk(b"IEND", b""))
    path.write_bytes(data)


class NowcastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str = Field(min_length=1, max_length=128)
    lead_times_minutes: list[int] = Field(min_length=1, max_length=12)

    @field_validator("lead_times_minutes")
    @classmethod
    def validate_leads(cls, values: list[int]) -> list[int]:
        if len(values) != len(set(values)):
            raise ValueError("lead_times_minutes must not contain duplicates")
        if any(value < 0 for value in values):
            raise ValueError("lead times must be non-negative")
        unsupported = sorted(set(values) - ALLOWED_LEADS)
        if unsupported:
            raise ValueError(f"unsupported lead times: {unsupported}; this illustrative fixture supports only 15 minutes")
        return sorted(values)


app = FastAPI(title="SIH26084 Nowcast API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "synthetic", "forecast_method": "fixture"}


@app.get("/api/v1/capabilities")
def capabilities() -> dict:
    fixture = _load_fixture()
    return {
        "schema_version": "1.0", "desired_coverage_minutes": [0, 360],
        "supported_lead_times_minutes": [15], "mode": "synthetic", "forecast_method": "fixture",
        "hazard_availability": {"storm_intensity_proxy": "unavailable", "hail": "unavailable", "lightning": "unavailable", "downburst": "unavailable", "cloudburst": "unavailable"},
        "sources": fixture.get("sources", []), "source_freshness": "unknown; metadata-only fixture",
        "missing_sensors": ["radar", "satellite", "lightning"],
        "warnings": ["Illustrative placeholder only; no observations or weather prediction is included.", "Desired 0–6 hour coverage is not supported by this fixture."],
    }


@app.get("/api/v1/events")
def events() -> dict:
    fixture = _load_fixture()
    return {"events": [{"event_id": fixture["event_id"], "mode": fixture["mode"], "event_time_utc": fixture["event_time_utc"], "sources": fixture["sources"], "status": "illustrative_metadata_only"}]}


@app.post("/api/v1/nowcasts", status_code=201)
def create_nowcast(request: NowcastRequest) -> dict:
    fixture = _load_fixture()
    if request.event_id != fixture.get("event_id"):
        raise HTTPException(status_code=404, detail="Unknown event_id.")
    run_id = uuid4().hex
    event_time = datetime.fromisoformat(fixture["event_time_utc"].replace("Z", "+00:00"))
    issued_at = _utc_now()
    run_dir = (RUNS_DIR / run_id).resolve()
    if run_dir.parent != RUNS_DIR:
        raise HTTPException(status_code=400, detail="Invalid run path.")
    run_dir.mkdir(parents=True, exist_ok=False)
    _write_illustrative_png(run_dir / ARTIFACT_NAME)
    bounds = fixture.get("grid", {}).get("bounds_wgs84")
    bundle = {
        "schema_version": "1.0", "run_id": run_id, "event_id": fixture["event_id"],
        "mode": "synthetic", "forecast_method": "fixture", "issued_at_utc": _iso(issued_at),
        "event_time_utc": _iso(event_time), "supported_lead_times_minutes": request.lead_times_minutes,
        "sources": fixture.get("sources", []),
        "source_freshness": "unknown; metadata-only fixture has no sensor timestamps",
        "missing_sensors": ["radar", "satellite", "lightning"],
        "model": {"id": "illustrative-fixture", "version": "1", "checkpoint_sha256": None},
        "grid": fixture.get("grid", {}),
        "geography": {"status": "available" if bounds else "unavailable", "crs": "EPSG:4326" if bounds else None, "bounds_wgs84": bounds, "zones": empty_zones()},
        "frames": [{"lead_minutes": lead, "valid_time_utc": _iso(event_time + timedelta(minutes=lead)), "image_url": f"/api/v1/artifacts/{run_id}/{ARTIFACT_NAME}", "variable": "illustrative_placeholder", "units": "none"} for lead in request.lead_times_minutes],
        "hazards": assess_hazards(has_observations=bool(fixture.get("observed_array_path")), has_geography=bool(bounds)),
        "warnings": ["Illustrative synthetic placeholder; it contains no weather field and has no forecast skill.", "Source freshness is unknown and radar, satellite, and lightning inputs are absent.", "No observation array, validated hazard method, or georeferenced bounds are present.", "Arrival estimates are unavailable; no track or target area exists."],
    }
    (run_dir / "bundle.json").write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    return bundle


@app.get("/api/v1/nowcasts/{run_id}")
def get_nowcast(run_id: str) -> dict:
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise HTTPException(status_code=404, detail="Nowcast run not found.")
    path = (RUNS_DIR / run_id / "bundle.json").resolve()
    if path.parent.parent != RUNS_DIR or not path.is_file():
        raise HTTPException(status_code=404, detail="Nowcast run not found.")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/v1/artifacts/{run_id}/{filename}")
def get_artifact(run_id: str, filename: str) -> FileResponse:
    if not RUN_ID_PATTERN.fullmatch(run_id) or filename != ARTIFACT_NAME:
        raise HTTPException(status_code=404, detail="Artifact not found.")
    run_dir = (RUNS_DIR / run_id).resolve()
    artifact = (run_dir / filename).resolve()
    if run_dir.parent != RUNS_DIR or artifact.parent != run_dir or not artifact.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found.")
    return FileResponse(artifact, media_type="image/png", filename=filename)
