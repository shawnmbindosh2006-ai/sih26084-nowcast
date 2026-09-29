"""Cross-branch tests: run after the reviewed data/model modules are available."""

from __future__ import annotations

import io
import struct
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

from nowcast.api import app as api_module

fixture_module = pytest.importorskip("nowcast.data.fixture")
pytest.importorskip("nowcast.data.loader")
pytest.importorskip("nowcast.models.persistence")


def _png_alpha(payload: bytes, x: int, y: int) -> int:
    assert payload.startswith(b"\x89PNG\r\n\x1a\n")
    offset, compressed, width = 8, b"", None
    while offset < len(payload):
        length = struct.unpack_from(">I", payload, offset)[0]
        kind = payload[offset + 4:offset + 8]
        chunk = payload[offset + 8:offset + 8 + length]
        if kind == b"IHDR":
            width = struct.unpack_from(">I", chunk)[0]
        if kind == b"IDAT":
            compressed += chunk
        offset += length + 12
    scanline = zlib.decompress(compressed)
    row_start = y * (1 + width * 4)
    assert scanline[row_start] == 0  # PNG filter: none
    return scanline[row_start + 1 + x * 4 + 3]


@pytest.fixture
def configured_api(tmp_path, monkeypatch):
    event_path = fixture_module.generate_fixture(tmp_path / "observed-event")
    monkeypatch.setattr(api_module, "PERSISTENCE_EVENT_PATH", event_path)
    monkeypatch.setattr(api_module, "RUNS_DIR", (tmp_path / "runs").resolve())
    # The evaluation target is deliberately absent during inference.
    (event_path.parent / "evaluation-targets.npy").unlink()
    return TestClient(api_module.app), event_path


def test_fixture_and_persistence_stay_distinct(configured_api):
    client, event_path = configured_api
    assert client.get("/health").json()["forecast_method"] == "persistence"
    events = client.get("/api/v1/events").json()["events"]
    persistence_id = events[0]["event_id"]
    assert persistence_id == "persistence:synthetic-demo-001"
    assert events[0]["source_event_id"] == "synthetic-demo-001"
    assert events[0]["forecast_method"] == "persistence"
    assert events[1]["forecast_method"] == "fixture"
    capabilities = client.get("/api/v1/capabilities").json()
    assert capabilities["supported_lead_times_minutes"] == [30, 60]
    assert capabilities["forecast_method"] == "persistence"
    assert capabilities["available_pipelines"]["fixture"]["supported_lead_times_minutes"] == [15]

    fixture = client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15]})
    assert fixture.status_code == 201
    assert fixture.json()["mode"] == "synthetic"
    assert fixture.json()["forecast_method"] == "fixture"
    assert fixture.json()["frames"][0]["variable"] == "illustrative_placeholder"
    assert client.post("/api/v1/nowcasts", json={"event_id": persistence_id, "lead_times_minutes": [15]}).status_code == 422
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [30]}).status_code == 422
    for lead in (90, 180, 360):
        assert client.post("/api/v1/nowcasts", json={"event_id": persistence_id, "lead_times_minutes": [lead]}).status_code == 422
    assert event_path.is_file()


def test_observed_only_persistence_artifacts_and_contract(configured_api):
    client, event_path = configured_api
    event_id = client.get("/api/v1/events").json()["events"][0]["event_id"]
    response = client.post("/api/v1/nowcasts", json={"event_id": event_id, "lead_times_minutes": [30, 60]})
    assert response.status_code == 201
    bundle = response.json()
    assert bundle["schema_version"] == "1.0"
    assert bundle["event_id"] == event_id
    assert bundle["source_event_id"] == "synthetic-demo-001"
    assert bundle["mode"] == "synthetic" and bundle["forecast_method"] == "persistence"
    assert bundle["run_id"].startswith("persistence-")
    assert bundle["supported_lead_times_minutes"] == [30, 60]
    assert bundle["event_time_utc"] == "2026-01-01T00:55:00Z"
    assert bundle["issued_at_utc"].endswith("Z")
    assert bundle["model"] == {"id": "cpu-persistence", "version": "1.0", "checkpoint_sha256": None}
    assert bundle["grid"]["bounds_wgs84"] is None
    assert bundle["sources"][0]["availability"] == "synthetic"
    assert [frame["lead_minutes"] for frame in bundle["frames"]] == [30, 60]
    assert [frame["valid_time_utc"] for frame in bundle["frames"]] == ["2026-01-01T01:25:00Z", "2026-01-01T01:55:00Z"]
    assert client.get(f'/api/v1/nowcasts/{bundle["run_id"]}').json() == bundle
    assert any("NaN mask" in warning for warning in bundle["warnings"])
    assert "evaluation_target_array_path" not in bundle
    assert all(hazard["status"] == "unavailable" and hazard["probability"] is None for hazard in bundle["hazards"].values())

    observed = np.load(event_path.parent / "observed.npy", allow_pickle=False)
    for frame in bundle["frames"]:
        assert frame["variable"] == "demo_intensity" and frame["units"] == "arbitrary_demo_units"
        assert frame["image_url"].startswith(f'/api/v1/artifacts/{bundle["run_id"]}/')
        assert frame["numeric_array_url"].startswith(f'/api/v1/artifacts/{bundle["run_id"]}/')
        image = client.get(frame["image_url"])
        numeric = client.get(frame["numeric_array_url"])
        assert image.status_code == 200 and image.headers["content-type"] == "image/png"
        assert numeric.status_code == 200 and numeric.headers["content-type"] == "application/octet-stream"
        assert _png_alpha(image.content, 0, 0) == 0  # Invalid/masked pixel remains transparent.
        plane = np.load(io.BytesIO(numeric.content), allow_pickle=False)
        assert np.isnan(plane[0, 0])
        assert plane[0, 31] == 0 and observed[-1, 0, 31, 0] == 0
        assert _png_alpha(image.content, 31, 0) == 255  # Genuine zero remains valid/opaque.
        np.testing.assert_array_equal(plane[1:, 1:], observed[-1, 1:, 1:, 0])
        assert frame["display"]["missing_pixels"] == 1
    assert client.get(f'/api/v1/artifacts/{bundle["run_id"]}/lead-999-channel-00.npy').status_code == 404
    assert client.get(f'/api/v1/artifacts/{bundle["run_id"]}/..%2F..%2Fsecret.npy').status_code == 404
