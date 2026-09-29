# Fixture API demo

The service is a local, synchronous FastAPI demo. Start it from the repository root:

```powershell
$env:PYTHONPATH = 'src'
uvicorn nowcast.api.app:app --reload
```

Create a clearly illustrative synthetic placeholder:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/nowcasts `
  -ContentType 'application/json' `
  -Body '{"event_id":"synthetic-demo-001","lead_times_minutes":[15]}'
```

Example response excerpt (run ID shortened here):

```json
{
  "schema_version": "1.0",
  "run_id": "<32-character-hex-id>",
  "event_id": "synthetic-demo-001",
  "mode": "synthetic",
  "forecast_method": "fixture",
  "supported_lead_times_minutes": [15],
  "source_freshness": "unknown; metadata-only fixture has no sensor timestamps",
  "missing_sensors": ["radar", "satellite", "lightning"],
  "frames": [{
    "lead_minutes": 15,
    "valid_time_utc": "2026-01-01T00:15:00Z",
    "image_url": "/api/v1/artifacts/<32-character-hex-id>/illustrative-frame.png",
    "variable": "illustrative_placeholder",
    "units": "none"
  }],
  "hazards": {
    "hail": {
      "status": "unavailable",
      "probability": null,
      "units": null,
      "method": null,
      "reason": "No observation array is present in the metadata-only fixture. Geographic bounds are unknown; no hazard zones or arrival estimates can be derived.",
      "zones": {"type": "FeatureCollection", "features": []},
      "estimated_arrival_utc": null,
      "timing_uncertainty_minutes": null
    }
  },
  "warnings": ["Illustrative synthetic placeholder; it contains no weather field and has no forecast skill."]
}
```

The response follows ForecastBundle v1 (`schema_version`, `run_id`, `mode`, `forecast_method`, UTC timestamps, sources, model, grid/geography, frames, hazards, warnings). The frame is a neutral PNG placeholder labeled `illustrative_placeholder`; it contains no weather field. Its existence demonstrates artifact delivery only. A request for an unsupported lead time (including 90, 180, or 360 minutes) receives HTTP 422. Unknown event IDs receive HTTP 404. Extra JSON properties are rejected.

The bundle is saved under `runs/<run_id>/bundle.json`; its image URL is `/api/v1/artifacts/<run_id>/illustrative-frame.png`. Configure `NOWCAST_RUNS_DIR` to select another local run directory. Artifact names and run IDs are allowlisted and resolved paths must remain inside that run directory.

Capabilities report desired coverage as 0–360 minutes separately from the fixture's supported `[15]`. Sensor freshness is unknown. Radar, satellite, and lightning are absent. Hazard assessments, including the VIL storm-intensity proxy, remain unavailable with `probability: null` because the fixture has neither observed arrays nor documented VIL encoding/threshold. Zones are empty because valid georeferenced bounds are absent. No arrival countdown is inferred.

For endpoint checks, from the repository root:

```powershell
$env:PYTHONPATH = 'src'
pytest -q tests/api tests/hazards
```

Allowed browser origins are `http://localhost:5173` and `http://127.0.0.1:5173`.

## Manish persistence integration (takeover branch)

Devananda's metadata-only +15 fixture remains available with `mode=synthetic` and `forecast_method=fixture`. When `NOWCAST_EVENT_PATH` names a validated Harinandana EventBundle, the API also exposes a distinct `persistence:<source_event_id>` event. `GET /api/v1/events` lists that event first for the dashboard; `GET /api/v1/capabilities` advertises its supported `[30,60]` leads and separately lists the fixture's `[15]` capability. The existing POST body is unchanged: `{ "event_id": "persistence:synthetic-demo-001", "lead_times_minutes": [30,60] }`. Unsupported leads return 422.

The API calls the observed-only loader, then `PersistenceNowcaster` with only the validated EventBundle fields. Evaluation targets are neither passed nor opened. The model's `persistence-<32 hex>` run ID and numeric `lead-XXX-channel-YY.npy` artifacts are retained. For each numeric plane, the API registers a deterministic RGBA PNG at `lead-XXX-channel-YY.png`; invalid/NaN pixels have alpha 0, while valid zeros retain alpha 255. PNG grayscale is normalized per frame solely for display and is not a calibrated meteorological scale. Each ForecastBundle frame has an API `image_url`, a `numeric_array_url`, and display-range metadata. Both artifacts are served only if registered in the saved bundle. Unknown bounds stay null, so the dashboard uses an image view rather than invented map coordinates. Hazards remain unavailable with null probabilities.

The public persistence event ID prevents collision with the legacy fixture's `synthetic-demo-001`; `source_event_id` retains the original EventBundle identifier. This is a pipeline alias, not a new observation. The fixture path remains usable without the data/model modules. The persistence path requires PRs #3 and #2 before deployment; see `docs/INTEGRATION.md` and `docs/LOCAL_RUN.md`.
