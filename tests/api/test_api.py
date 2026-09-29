import json
from io import BytesIO

import numpy as np
import pytest

from fastapi.testclient import TestClient

from nowcast.api.app import ARTIFACT_NAME, app


client = TestClient(app)


def test_health_capabilities_and_event_inventory():
    assert client.get("/health").json()["status"] == "ok"
    caps = client.get("/api/v1/capabilities").json()
    assert caps["supported_lead_times_minutes"] == [15]
    assert caps["missing_sensors"] == ["radar", "satellite", "lightning"]
    assert client.get("/api/v1/events").json()["events"][0]["event_id"] == "synthetic-demo-001"


def test_create_get_and_artifact_are_safe(tmp_path, monkeypatch):
    monkeypatch.setattr("nowcast.api.app.RUNS_DIR", tmp_path.resolve())
    response = client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15]})
    assert response.status_code == 201
    bundle = response.json()
    assert bundle["mode"] == "synthetic" and bundle["forecast_method"] == "fixture"
    assert bundle["frames"][0]["variable"] == "illustrative_placeholder"
    run_id = bundle["run_id"]
    assert client.get(f"/api/v1/nowcasts/{run_id}").json() == bundle
    artifact_url = bundle["frames"][0]["image_url"]
    artifact = client.get(artifact_url)
    assert artifact.status_code == 200 and artifact.content.startswith(b"\x89PNG")
    assert artifact.headers["content-type"] == "image/png"
    assert (tmp_path / run_id / "bundle.json").is_file()
    assert artifact_url.endswith(ARTIFACT_NAME)


def test_unavailable_hazards_are_null_not_zero():
    bundle = client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15]}).json()
    for hazard in bundle["hazards"].values():
        assert hazard["status"] == "unavailable"
        assert hazard["probability"] is None
        assert hazard["zones"] == {"type": "FeatureCollection", "features": []}


def test_rejects_bad_event_leads_and_extra_fields():
    assert client.post("/api/v1/nowcasts", json={"event_id": "missing", "lead_times_minutes": [15]}).status_code == 404
    for leads in ([-1], [90], [360], [15, 15]):
        assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": leads}).status_code == 422
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15], "path": "C:/secret"}).status_code == 422


def test_artifact_paths_are_confined():
    assert client.get("/api/v1/artifacts/..%2F..%2Fsecret/illustrative-frame.png").status_code == 404
    assert client.get("/api/v1/artifacts/00000000000000000000000000000000/../../secret").status_code == 404
    assert client.get("/api/v1/nowcasts/not-a-run-id").status_code == 404


def test_event_bundle_persistence_api_and_artifacts(tmp_path, monkeypatch):
    pytest.importorskip("nowcast.data.fixture")
    pytest.importorskip("nowcast.models.persistence")
    from nowcast.data.fixture import generate_fixture

    manifest = generate_fixture(tmp_path / "event")
    monkeypatch.setenv("NOWCAST_EVENT_BUNDLE_PATH", str(manifest))
    monkeypatch.setattr("nowcast.api.app.RUNS_DIR", (tmp_path / "runs").resolve())
    caps = client.get("/api/v1/capabilities").json()
    assert caps["supported_lead_times_minutes"] == [30, 60]
    assert caps["available_pipelines"]["fixture"]["supported_lead_times_minutes"] == [15]
    assert {item["forecast_method"] for item in client.get("/api/v1/events").json()["events"]} == {"fixture", "persistence"}

    response = client.post("/api/v1/nowcasts", json={
        "event_id": "synthetic-demo-001", "lead_times_minutes": [30, 60]
    })
    assert response.status_code == 201, response.text
    bundle = response.json()
    assert bundle["schema_version"] == "1.0"
    assert bundle["forecast_method"] == "persistence"
    assert bundle["run_id"].startswith("persistence-")
    assert [frame["lead_minutes"] for frame in bundle["frames"]] == [30, 60]
    assert client.get(f"/api/v1/nowcasts/{bundle['run_id']}").json() == bundle
    final = np.load(tmp_path / "event" / "observed.npy", allow_pickle=False)[-1, :, :, 0]
    for frame in bundle["frames"]:
        image = client.get(frame["image_url"])
        numeric = client.get(frame["numeric_url"])
        assert image.status_code == 200 and image.headers["content-type"] == "image/png"
        assert image.content.startswith(b"\x89PNG\r\n\x1a\n")
        assert numeric.status_code == 200 and numeric.headers["content-type"] == "application/octet-stream"
        actual = np.load(BytesIO(numeric.content), allow_pickle=False)
        assert np.isnan(actual[0, 0])
        np.testing.assert_array_equal(actual[1:, :], final[1:, :])
        np.testing.assert_array_equal(actual[0, 1:], final[0, 1:])
    for hazard in bundle["hazards"].values():
        assert hazard["status"] == "unavailable"
        assert hazard["probability"] is None
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [90]}).status_code == 422
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [30], "forecast_method": "fixture"}).status_code == 422
    assert client.get(f"/api/v1/artifacts/{bundle['run_id']}/bundle.json").status_code == 404
    fixture = client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15]}).json()
    assert fixture["forecast_method"] == "fixture"
