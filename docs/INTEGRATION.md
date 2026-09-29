# Data → persistence → API integration

This document combines the reviewed data/model boundary with Manish's API
integration on top of Devananda's fixture scaffold. The current forecast is a
CPU persistence baseline, **not** EarthFormer, learned inference, or evidence of
weather skill.

## Event and model boundary

`nowcast.models.predict(event, lead_times)` implements the shared two-argument
interface. `PersistenceNowcaster` accepts an explicit artifact root for API and
test integration.

The validated EventBundle loader checks `schema_version=1.0`, event ID and mode,
strictly increasing UTC timestamps and cadence, `[T,H,W,C]` observed-array
shape, channel names and units, sources, quality-mask shape and `True=valid`
polarity, and grid spacing/CRS/bounds. The persistence adapter reads only
`observed_array_path` and the optional quality mask. Evaluation metadata and
future target arrays are not part of the prediction interface and are not
opened or inspected.

The last observed mask is broadcast across channels when supplied as
`[T,H,W]` or `[T,H,W,1]`, or applied per channel when supplied as `[T,H,W,C]`.
Invalid forecast pixels are stored as `NaN`; valid numeric zeros remain zero.
Masked output therefore uses a floating dtype even when the observations are
integral. Renderers and metrics must treat nonfinite pixels as missing.

The model interface accepts unique increasing five-minute leads from +5 through
+60. The integrated API intentionally exposes only +30 and +60 for persistence.
+90, +180, +360 and other unsupported API leads are rejected. This bounded
interface is not a claim that persistence has useful forecast skill throughout
the period.

## API event selection

Set `NOWCAST_EVENT_BUNDLE_PATH` (Devananda's original setting) or
`NOWCAST_EVENT_PATH` to a validated EventBundle manifest. The API publishes the
source as `persistence:<source_event_id>` so it cannot collide with Devananda's
existing `synthetic-demo-001` fixture route. The ForecastBundle retains the
public event ID and records `source_event_id` for provenance. The observed
array, mask, grid and source records are not altered.

Without an EventBundle setting, only the original synthetic +15 fixture is
available. With an EventBundle, `GET /api/v1/capabilities` advertises persistence
`[30,60]` as the default and fixture `[15]` as a separate pipeline.
`GET /api/v1/events` lists the persistence alias first. `POST
/api/v1/nowcasts` uses `{event_id,lead_times_minutes}`. Explicit fixture mode
cannot select +30/+60, and unsupported leads return 422.

`issued_at_utc` is the API run time. `event_time_utc` is the last observed
timestamp. Archived or synthetic event times are not presented as live arrival
estimates.

## ForecastBundle and artifacts

The model's stable `persistence-<32 hex>` identifier is also the API run ID.
For each requested lead and channel, the final observed `[H,W]` plane is stored
under `<artifact_root>/<run_id>/` as a numeric NumPy file. The API also creates
a same-lead PNG preview:

- finite numeric values are rendered as opaque grayscale;
- nonfinite/masked cells are transparent;
- per-frame min/max scaling is display-only;
- no VIL-to-rainfall or other physical conversion is inferred.

`frames[].image_url` references the PNG and `frames[].numeric_array_url`
references the `.npy`. Both are relative API routes:

```text
/api/v1/artifacts/<run_id>/<filename>
```

No local filesystem path is exposed. Bundle retrieval and artifact serving use
restricted run-ID/filename patterns, path confinement and the saved bundle's
registered-URL allowlist.

ForecastBundle v1 retains `schema_version`, `run_id`, `event_id`, `mode`,
`forecast_method=persistence`, UTC times, supported leads, sources, model
identity/checkpoint null, grid, frames, hazards and warnings. Unknown
`grid.bounds_wgs84` and CRS remain null. Hail, lightning, downburst, cloudburst
and storm-intensity proxy remain `status=unavailable` with `probability=null`.
No calibrated risk, Indian location, learned-model claim or six-hour capability
is inferred.

## Fixture and evaluation boundary

The tracked `fixtures/demo-event.json` is metadata-only and correctly fails
model prediction because `observed_array_path` is null. Harinandana's generator
and `scripts/generate-model-fixture.py` create deterministic synthetic plumbing
under ignored `runs/` paths. They are not observations or skill evidence.

`nowcast.evaluation` reports MAE, RMSE, CSI, POD and FAR separately by lead.
Hits, misses and false alarms are recorded, and zero denominators return null.
Thresholds and units are supplied by the caller. Evaluation targets must be
loaded separately from inference. Until archived observed future frames exist,
the result is: **pipeline checks completed; weather-skill evaluation
unavailable.**

## Provenance and limitations

Devananda's fixture/API history is preserved through commit `e191bbb`. Manish's
takeover commits add the validated EventBundle → persistence route and API-served
numeric/display artifacts. Harinandana's deterministic integration fixture is
synthetic `demo_intensity` in `arbitrary_demo_units`, with
`[12,32,32,1]` observed frames, five-minute UTC cadence and null geography.

The path does not integrate EarthFormer, pySTEPS, LDCast, real sensors,
calibrated hazards, georeferenced forecast skill or 0–6 hour learned output.
Run and test commands are in `docs/LOCAL_RUN.md`.

## Current merged-baseline verification

After PR #2 was merged into `develop` at `4997022`, PR #7 was reconciled with
that base and validated using Python 3.11.9 / NumPy 2.1.3 on Windows:

```text
tests/data                                      22 passed
tests/models tests/evaluation                  16 passed
tests/api/test_api.py                           6 passed
tests/hazards                                   1 passed
tests/api/test_persistence_integration.py       2 passed
combined                                       47 passed
```

The two formerly dependency-gated integration tests ran rather than skipped.
An actual local HTTP smoke returned `200` for health, capabilities, events,
saved-nowcast retrieval, PNG and NumPy artifacts; persistence +30/+60 returned
`201`; +90/+180/+360 returned `422`. The smoke retained null CRS/bounds,
`forecast_method=persistence`, API-relative artifact URLs and unavailable/null
hazards. The integration tests additionally verified NaN numeric pixels,
transparent PNG pixels, opaque valid zero pixels, target-file absence during
inference and traversal rejection. One upstream Starlette/httpx TestClient
deprecation warning remains.
