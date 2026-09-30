import assert from "node:assert/strict";
import test from "node:test";
import {
  combineHazardZones,
  forecastRunUrl,
  formatLead,
  hazardPresentation,
  methodLabel,
  modeLabel,
  normalizeDashboardData,
  resolveArtifactUrl,
  sourceSummary,
  validWgs84Bounds,
} from "./dashboardModel.js";

test("normalizes ForecastBundle v1 and keeps only returned supported frames", () => {
  const view = normalizeDashboardData({
    mode: "replay",
    forecast_method: "persistence",
    event_time_utc: "2026-09-30T10:00:00Z",
    issued_at_utc: "2026-09-30T10:01:00Z",
    supported_lead_times_minutes: [30, 60],
    frames: [
      { lead_minutes: 60, valid_time_utc: "2026-09-30T11:00:00Z" },
      { lead_minutes: 90, valid_time_utc: "2026-09-30T11:30:00Z" },
      { lead_minutes: 30, valid_time_utc: "2026-09-30T10:30:00Z" },
    ],
  });

  assert.deepEqual(view.frames.map((frame) => frame.lead_minutes), [30, 60]);
  assert.equal(view.mode, "replay");
  assert.equal(view.method, "persistence");
});

test("maps labels from the response's actual method and mode", () => {
  assert.equal(methodLabel("persistence"), "Persistence");
  assert.equal(methodLabel("optical_flow"), "Optical Flow");
  assert.equal(methodLabel("experimental-x"), "experimental-x");
  assert.equal(modeLabel("replay"), "REPLAY · ARCHIVED");
  assert.equal(modeLabel("synthetic_demo"), "SYNTHETIC DEMO");
  assert.equal(modeLabel("api"), "MODE UNAVAILABLE");
});

test("normalizes the local fixture without exposing unsupported horizons", () => {
  const view = normalizeDashboardData({
    mode: "synthetic_demo",
    issue_time_utc: "2026-09-30T10:00:00Z",
    provenance: { dataset: "local synthetic fixture", local_path: "C:\\data\\fixture.json" },
    leads: [
      { lead_minutes: 60, supported: true },
      { lead_minutes: 90, supported: false },
      { lead_minutes: 30, supported: true },
    ],
  });

  assert.equal(view.mode, "synthetic");
  assert.deepEqual(view.frames.map((frame) => frame.lead_minutes), [30, 60]);
  assert.equal(view.sourceText, "local synthetic fixture");
  assert.equal(formatLead(0), "Observed");
  assert.equal(formatLead(30), "+30 min");
});

test("keeps unsupported hazards unavailable and only formats validated probabilities", () => {
  assert.deepEqual(hazardPresentation({ status: "unavailable", probability: null }).value, "Not available");
  assert.equal(hazardPresentation({ status: "proxy", probability: 0.8 }).value, "Proxy only");
  assert.equal(hazardPresentation({ status: "validated", probability: 0 }).value, "0%");
  assert.equal(hazardPresentation({ status: "validated", probability: 1.2 }).value, "Not available");
});

test("accepts only valid WGS84 bounds", () => {
  assert.equal(validWgs84Bounds([-125, 24, -66, 50]), true);
  assert.equal(validWgs84Bounds([0, 0, 0, 10]), false);
  assert.equal(validWgs84Bounds(null), false);
});

test("resolves API artifact URLs and rejects local filesystem paths", () => {
  assert.equal(
    resolveArtifactUrl("/api/v1/artifacts/run-1/frame.png", "http://localhost:8000"),
    "http://localhost:8000/api/v1/artifacts/run-1/frame.png",
  );
  assert.equal(resolveArtifactUrl("C:\\temp\\frame.png", "http://localhost:8000"), null);
  assert.equal(resolveArtifactUrl(null, "http://localhost:8000"), null);
});

test("builds the documented saved-run endpoint without altering the run ID", () => {
  assert.equal(
    forecastRunUrl("http://localhost:8000", "run/one"),
    "http://localhost:8000/api/v1/nowcasts/run%2Fone",
  );
  assert.equal(forecastRunUrl("", "run-1"), null);
});

test("keeps metrics hidden because ForecastBundle v1 defines no evaluation metrics field", () => {
  const view = normalizeDashboardData({
    frames: [],
    supported_lead_times_minutes: [],
    metrics: { csi: 0.5 },
  });
  assert.equal(view.metrics, null);
});

test("combines only backend-provided hazard zone features", () => {
  const feature = { type: "Feature", geometry: null, properties: {} };
  assert.deepEqual(combineHazardZones({ hail: { zones: { type: "FeatureCollection", features: [feature] } } }), {
    type: "FeatureCollection",
    features: [feature],
  });
  assert.equal(combineHazardZones({}), null);
});

test("summarizes source metadata without exposing local paths", () => {
  assert.equal(
    sourceSummary({ provider: "NOAA", product: "MRMS", path: "D:\\private\\data.grib2" }),
    "NOAA · MRMS",
  );
});
