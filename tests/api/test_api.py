import json

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
