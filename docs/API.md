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
