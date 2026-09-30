import json
from io import BytesIO

import numpy as np
import pytest

from fastapi.testclient import TestClient

from nowcast.api import app as api_module
from nowcast.api.app import ARTIFACT_NAME, app


client = TestClient(app)


def test_health_capabilities_and_event_inventory(monkeypatch):
    monkeypatch.delenv("NOWCAST_EVENT_BUNDLE_PATH", raising=False)
    monkeypatch.delenv("NOWCAST_EVENT_PATH", raising=False)
    monkeypatch.setattr(api_module, "PERSISTENCE_EVENT_PATH", None)
    assert client.get("/health").json()["status"] == "ok"
    caps = client.get("/api/v1/capabilities").json()
    assert caps["supported_lead_times_minutes"] == [15]
    assert caps["forecast_methods"] == ["fixture"]
    assert caps["available_pipelines"] == {
        "fixture": {"event_id": "synthetic-demo-001", "supported_lead_times_minutes": [15]}
    }
    assert caps["missing_sensors"] == ["radar", "satellite", "lightning"]
    assert client.get("/api/v1/events").json()["events"][0]["event_id"] == "synthetic-demo-001"


def test_invalid_configured_event_bundle_is_reported(monkeypatch, tmp_path):
    monkeypatch.setenv("NOWCAST_EVENT_BUNDLE_PATH", str(tmp_path / "missing-event.json"))
    monkeypatch.delenv("NOWCAST_EVENT_PATH", raising=False)
    monkeypatch.setattr(api_module, "PERSISTENCE_EVENT_PATH", None)

    response = client.get("/api/v1/capabilities")

    assert response.status_code == 503
    assert response.json()["detail"] == "The configured persistence EventBundle is unavailable or invalid."


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
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15], "forecast_method": "optical_flow"}).status_code == 422
    assert client.post("/api/v1/nowcasts", json={"event_id": "synthetic-demo-001", "lead_times_minutes": [15], "forecast_method": "earthformer"}).status_code == 422
    assert client.post("/api/v1/nowcasts", json={"event_id": "missing", "lead_times_minutes": [15], "forecast_method": "fixture"}).status_code == 422


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
    monkeypatch.setattr(api_module, "_optical_flow_provider_class", lambda event=None: None)
    caps = client.get("/api/v1/capabilities").json()
    assert caps["supported_lead_times_minutes"] == [30, 60]
    assert caps["forecast_methods"] == ["fixture", "persistence"]
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
    explicitly_selected = client.post("/api/v1/nowcasts", json={
        "event_id": "synthetic-demo-001", "lead_times_minutes": [30], "forecast_method": "persistence"
    })
    assert explicitly_selected.status_code == 201
    assert explicitly_selected.json()["forecast_method"] == "persistence"
    assert client.post("/api/v1/nowcasts", json={
        "event_id": "synthetic-demo-001", "lead_times_minutes": [30], "forecast_method": "optical_flow"
    }).status_code == 422
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


def test_capabilities_advertise_registered_optical_flow_and_route_artifacts(tmp_path, monkeypatch):
    pytest.importorskip("nowcast.data.fixture")
    from nowcast.data.fixture import generate_fixture

    manifest = generate_fixture(tmp_path / "event")
    monkeypatch.setattr(api_module, "PERSISTENCE_EVENT_PATH", manifest)
    monkeypatch.setattr(api_module, "RUNS_DIR", (tmp_path / "runs").resolve())

    class StubOpticalFlow:
        def __init__(self, artifact_root, supported_lead_times_minutes):
            self.artifact_root = artifact_root
            self.supported_lead_times_minutes = supported_lead_times_minutes

        def predict(self, event, lead_times):
            assert event["event_id"] == "persistence:synthetic-demo-001"
            assert lead_times == [30]
            run_id = "optical-flow-" + "a" * 32
            run_dir = self.artifact_root / run_id
            run_dir.mkdir(parents=True)
            filename = "lead-030-channel-00.npy"
            np.save(run_dir / filename, np.zeros((32, 32), dtype=np.float32))
            hazards = {
                name: {"status": "unavailable", "probability": None,
                       "zones": {"type": "FeatureCollection", "features": []}}
                for name in ("storm_intensity_proxy", "hail", "lightning", "downburst", "cloudburst")
            }
            return {
                "schema_version": "1.0", "run_id": run_id, "event_id": event["event_id"],
                "mode": event["mode"], "forecast_method": "optical_flow",
                "issued_at_utc": "2026-01-01T01:00:00Z", "event_time_utc": event["event_time_utc"],
                "supported_lead_times_minutes": self.supported_lead_times_minutes,
                "sources": event["sources"], "model": {"id": "controlled-test-provider", "version": "test", "checkpoint_sha256": None},
                "grid": event["grid"], "frames": [{
                    "lead_minutes": 30, "valid_time_utc": "2026-01-01T01:25:00Z",
                    "image_url": f"/api/v1/artifacts/{run_id}/{filename}",
                    "variable": "demo_intensity", "units": "arbitrary_demo_units",
                }], "hazards": hazards, "warnings": [],
            }

    monkeypatch.setattr(api_module, "_optical_flow_provider_class", lambda event=None: StubOpticalFlow)
    capabilities = client.get("/api/v1/capabilities").json()
    assert capabilities["forecast_methods"] == ["fixture", "persistence", "optical_flow"]
    assert capabilities["available_pipelines"]["optical_flow"] == {
        "event_id": "persistence:synthetic-demo-001", "supported_lead_times_minutes": [30, 60]
    }

    response = client.post("/api/v1/nowcasts", json={
        "event_id": "synthetic-demo-001", "lead_times_minutes": [30], "forecast_method": "optical_flow"
    })
    assert response.status_code == 201, response.text
    bundle = response.json()
    assert bundle["forecast_method"] == "optical_flow"
    assert bundle["event_id"] == "persistence:synthetic-demo-001"
    assert bundle["hazards"]["hail"]["status"] == "unavailable"
    assert bundle["hazards"]["hail"]["probability"] is None
    frame = bundle["frames"][0]
    assert frame["image_url"].endswith("lead-030-channel-00.png")
    assert frame["numeric_array_url"].endswith("lead-030-channel-00.npy")
    assert client.get(frame["image_url"]).headers["content-type"] == "image/png"
    assert client.get(frame["numeric_array_url"]).headers["content-type"] == "application/octet-stream"
    assert client.get(f"/api/v1/artifacts/{bundle['run_id']}/../../secret.npy").status_code == 404


def test_explicit_fixture_and_optical_runtime_failure_semantics(tmp_path, monkeypatch):
    from nowcast.data.fixture import generate_fixture

    manifest = generate_fixture(tmp_path / "event")
    monkeypatch.setattr(api_module, "PERSISTENCE_EVENT_PATH", manifest)
    monkeypatch.setattr(api_module, "RUNS_DIR", (tmp_path / "runs").resolve())

    explicit_fixture = client.post("/api/v1/nowcasts", json={
        "event_id": "synthetic-demo-001", "lead_times_minutes": [15], "forecast_method": "fixture"
    })
    assert explicit_fixture.status_code == 201
    assert explicit_fixture.json()["forecast_method"] == "fixture"

    class FailingOpticalFlow:
        def __init__(self, artifact_root, supported_lead_times_minutes):
            pass

        def predict(self, event, lead_times):
            raise RuntimeError("controlled runtime failure")

    monkeypatch.setattr(
        api_module, "_optical_flow_provider_class", lambda event=None: FailingOpticalFlow
    )
    unavailable = client.post("/api/v1/nowcasts", json={
        "event_id": "persistence:synthetic-demo-001",
        "lead_times_minutes": [30],
        "forecast_method": "optical_flow",
    })
    assert unavailable.status_code == 503
    assert "controlled runtime failure" in unavailable.json()["detail"]

    unsupported = client.post("/api/v1/nowcasts", json={
        "event_id": "persistence:synthetic-demo-001",
        "lead_times_minutes": [90],
        "forecast_method": "optical_flow",
    })
    assert unsupported.status_code == 422
