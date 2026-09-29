"""FastAPI fixture and opt-in persistence baseline demonstration."""

from __future__ import annotations

import json
import os
import re
import struct
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from nowcast.hazards.assessment import assess_hazards, empty_zones
from nowcast.api.display import write_display_png

ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = ROOT / "fixtures" / "demo-event.json"
RUNS_DIR = Path(os.environ.get("NOWCAST_RUNS_DIR", str(ROOT / "runs"))).resolve()
ALLOWED_LEADS = {15}
PERSISTENCE_LEADS = {30, 60}
ARTIFACT_NAME = "illustrative-frame.png"
RUN_ID_PATTERN = re.compile(r"^(?:[0-9a-f]{32}|persistence-[0-9a-f]{32})$")
ARTIFACT_PATTERN = re.compile(r"^(?:illustrative-frame\.png|lead-[0-9]{3}-channel-[0-9]{2}\.(?:npy|png))$")
PERSISTENCE_EVENT_PATH = Path(os.environ["NOWCAST_EVENT_PATH"]).resolve() if os.environ.get("NOWCAST_EVENT_PATH") else None


def _load_fixture() -> dict:
    try:
        return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="The demonstration fixture is unavailable or invalid.") from exc


def _persistence_registration() -> tuple[str, dict] | None:
    """Load only Harinandana's validated inference fields, never evaluation targets."""
    path = _event_bundle_path()
    if path is None:
        return None
    try:
        from nowcast.data.loader import load_event

        event = load_event(path)
    except (ImportError, OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="The configured persistence EventBundle is unavailable or invalid.") from exc
    public_id = f"persistence:{event['event_id']}"
    if len(public_id) > 128:
        raise HTTPException(status_code=503, detail="The configured persistence event ID is too long.")
    return public_id, event


def _create_persistence_nowcast(event: dict, public_id: str, lead_times: list[int]) -> dict:
    try:
        from nowcast.models.persistence import PersistenceNowcaster
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="The persistence adapter is not installed.") from exc
    # load_event excludes evaluation metadata. The public ID distinguishes this
    # pipeline from the separate fixture endpoint without changing source files.
    inference_event = {**event, "event_id": public_id}
    bundle = PersistenceNowcaster(
        artifact_root=RUNS_DIR,
        supported_lead_times_minutes=sorted(PERSISTENCE_LEADS),
    ).predict(inference_event, lead_times)
    run_id = bundle["run_id"]
    run_dir = (RUNS_DIR / run_id).resolve()
    if run_dir.parent != RUNS_DIR or not RUN_ID_PATTERN.fullmatch(run_id):
        raise HTTPException(status_code=500, detail="Invalid persistence run identity.")
    for frame in bundle["frames"]:
        numeric_url = frame["image_url"]
        numeric_name = urlsplit(numeric_url).path.rsplit("/", 1)[-1]
        if not ARTIFACT_PATTERN.fullmatch(numeric_name) or not numeric_name.endswith(".npy"):
            raise HTTPException(status_code=500, detail="Invalid persistence artifact name.")
        png_name = numeric_name[:-4] + ".png"
        frame["display"] = write_display_png(run_dir / numeric_name, run_dir / png_name)
        frame["numeric_array_url"] = numeric_url
        frame["numeric_url"] = numeric_url  # PR #5 compatibility alias.
        frame["image_url"] = f"/api/v1/artifacts/{run_id}/{png_name}"
    bundle["source_event_id"] = event["event_id"]
    bundle["warnings"].append(
        "PNG frames are deterministic grayscale previews; numeric NumPy arrays retain the original values and NaN mask."
    )
    if any(source.get("availability") in {"missing", "unavailable"} for source in event["sources"]):
        bundle["warnings"].append("One or more declared input sources are missing or unavailable.")
    if event["mode"] != "live":
        bundle["warnings"].append("Archived/synthetic event timing is not a live arrival countdown.")
    (run_dir / "bundle.json").write_text(json.dumps(bundle, indent=2, allow_nan=False), encoding="utf-8")
    return bundle


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


def _event_bundle_path() -> Path | None:
    """Keep Devananda's environment name and the takeover alias compatible."""
    configured = os.environ.get("NOWCAST_EVENT_BUNDLE_PATH") or os.environ.get("NOWCAST_EVENT_PATH")
    return PERSISTENCE_EVENT_PATH or (Path(configured).resolve() if configured else None)


class NowcastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str = Field(min_length=1, max_length=128)
    lead_times_minutes: list[int] = Field(min_length=1, max_length=12)
    forecast_method: str | None = None

    @field_validator("lead_times_minutes")
    @classmethod
    def validate_leads(cls, values: list[int]) -> list[int]:
        if len(values) != len(set(values)):
            raise ValueError("lead_times_minutes must not contain duplicates")
        if any(value < 0 for value in values):
            raise ValueError("lead times must be non-negative")
        return sorted(values)

    @field_validator("forecast_method")
    @classmethod
    def validate_method(cls, value: str | None) -> str | None:
        if value not in (None, "fixture", "persistence"):
            raise ValueError("forecast_method must be fixture or persistence")
        return value


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
    registration = _persistence_registration()
    if registration:
        return {"status": "ok", "mode": registration[1]["mode"], "forecast_method": "persistence", "fixture_available": True}
    return {"status": "ok", "mode": "synthetic", "forecast_method": "fixture"}


@app.get("/api/v1/capabilities")
def capabilities() -> dict:
    fixture = _load_fixture()
    result = {
        "schema_version": "1.0", "desired_coverage_minutes": [0, 360],
        "supported_lead_times_minutes": [15],
        "mode": "synthetic", "forecast_method": "fixture",
        "forecast_methods": ["fixture"],
        "hazard_availability": {"storm_intensity_proxy": "unavailable", "hail": "unavailable", "lightning": "unavailable", "downburst": "unavailable", "cloudburst": "unavailable"},
        "sources": fixture.get("sources", []), "source_freshness": "unknown; metadata-only fixture",
        "missing_sensors": ["radar", "satellite", "lightning"],
        "warnings": ["Illustrative placeholder only; no observations or weather prediction is included.", "Desired 0–6 hour coverage is not supported by this fixture."],
    }
    registration = _persistence_registration()
    if registration:
        public_id, event = registration
        result.update({
            "supported_lead_times_minutes": sorted(PERSISTENCE_LEADS),
            "mode": event["mode"], "forecast_method": "persistence",
            "forecast_methods": ["fixture", "persistence"],
            "sources": event["sources"],
            "source_freshness": "not validated; inspect EventBundle timestamps and source availability",
            "missing_sensors": [source["id"] for source in event["sources"] if source.get("availability") in {"missing", "unavailable"}],
            "warnings": ["Persistence repeats the last observed frame; it is not learned inference or validated weather skill.", "Fixture +15 remains a separate illustrative path."],
            "available_pipelines": {
                "fixture": {"event_id": fixture["event_id"], "supported_lead_times_minutes": [15]},
                "persistence": {"event_id": public_id, "supported_lead_times_minutes": sorted(PERSISTENCE_LEADS)},
            },
        })
    return result


@app.get("/api/v1/events")
def events() -> dict:
    fixture = _load_fixture()
    available = [{"event_id": fixture["event_id"], "mode": fixture["mode"], "event_time_utc": fixture["event_time_utc"], "sources": fixture["sources"], "status": "illustrative_metadata_only", "forecast_method": "fixture"}]
    registration = _persistence_registration()
    if registration:
        public_id, event = registration
        available.insert(0, {"event_id": public_id, "source_event_id": event["event_id"], "mode": event["mode"], "event_time_utc": event["event_time_utc"], "sources": event["sources"], "status": "validated_observed", "forecast_method": "persistence"})
    return {"events": available}


@app.post("/api/v1/nowcasts", status_code=201)
def create_nowcast(request: NowcastRequest) -> dict:
    fixture = _load_fixture()
    registration = _persistence_registration()
    persistence_id = registration[0] if registration else None
    source_id = registration[1]["event_id"] if registration else None
    wants_persistence = registration and (
        request.event_id == persistence_id
        or (request.event_id == source_id and request.forecast_method != "fixture" and request.lead_times_minutes != [15])
    )
    if wants_persistence:
        if request.forecast_method == "fixture":
            raise HTTPException(status_code=422, detail="Fixture method is not available for the persistence event.")
        unsupported = sorted(set(request.lead_times_minutes) - PERSISTENCE_LEADS)
        if unsupported:
            raise HTTPException(status_code=422, detail=f"Unsupported persistence leads: {unsupported}; supported={sorted(PERSISTENCE_LEADS)}")
        return _create_persistence_nowcast(registration[1], persistence_id, request.lead_times_minutes)
    if request.forecast_method == "persistence":
        raise HTTPException(status_code=422, detail="Persistence requires a configured EventBundle and +30/+60 lead.")
    if request.event_id != fixture.get("event_id"):
        raise HTTPException(status_code=404, detail="Unknown event_id.")
    unsupported = sorted(set(request.lead_times_minutes) - ALLOWED_LEADS)
    if unsupported:
        raise HTTPException(status_code=422, detail=f"Unsupported fixture leads: {unsupported}; supported={[15]}")
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
    if not RUN_ID_PATTERN.fullmatch(run_id) or not ARTIFACT_PATTERN.fullmatch(filename):
        raise HTTPException(status_code=404, detail="Artifact not found.")
    run_dir = (RUNS_DIR / run_id).resolve()
    bundle_path = (run_dir / "bundle.json").resolve()
    artifact = (run_dir / filename).resolve()
    if run_dir.parent != RUNS_DIR or bundle_path.parent != run_dir or not bundle_path.is_file() or artifact.parent != run_dir or not artifact.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found.")
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    allowed = {
        url
        for frame in bundle.get("frames", [])
        for url in (frame.get("image_url"), frame.get("numeric_array_url"), frame.get("numeric_url"))
        if isinstance(url, str)
    }
    if f"/api/v1/artifacts/{run_id}/{filename}" not in allowed:
        raise HTTPException(status_code=404, detail="Artifact not found.")
    media_type = "image/png" if filename.endswith(".png") else "application/octet-stream"
    return FileResponse(artifact, media_type=media_type, filename=filename)
