# Data → persistence → API → dashboard integration

This is Manish's API integration on top of Devananda's fixture scaffold. It is a CPU persistence baseline, **not** EarthFormer or evidence of weather skill. PR #3 supplies Harinandana's validated EventBundle loader and deterministic synthetic fixture; PR #2 supplies Manish's masked persistence adapter. This API-only branch deliberately does not duplicate either teammate module. Merge/review ordering must account for those dependencies.

## Boundary and provenance

Set `NOWCAST_EVENT_PATH` to a validated EventBundle manifest. The loader checks `schema_version=1.0`, event ID and mode, UTC timestamps and cadence, `[T,H,W,C]` observed array shape, channel names/units, sources, quality-mask shape and `True=valid` polarity, and grid spacing/CRS/bounds. It returns only inference fields and absolute observed/mask paths. Evaluation target metadata and future arrays are not forwarded to `predict()`; an integration test deletes the target array before the API call and still succeeds.

The API publishes this source as `persistence:<source_event_id>` so it cannot collide with Devananda's existing `synthetic-demo-001` fixture route. The ForecastBundle retains that public event ID and also records `source_event_id` for provenance. The source array, mask, grid and source records are not altered. Without `NOWCAST_EVENT_PATH`, only the original synthetic +15 fixture is available.

When configured, `GET /api/v1/capabilities` advertises persistence `[30,60]` as the default selection and separately reports fixture `[15]` under `available_pipelines`. `GET /api/v1/events` lists persistence first, matching dashboard PR #6's current discovery flow. `POST /api/v1/nowcasts` uses the unchanged `{event_id,lead_times_minutes}` body; +30/+60 are accepted only for the persistence event. Unsupported leads return 422. `issued_at_utc` is the actual API run time; `event_time_utc` is the final observed timestamp. Archived/synthetic times are not presented as live arrival estimates.

## Artifacts and safety

The model's stable `persistence-<32 hex>` run ID is also the API run ID. Its numeric `lead-XXX-channel-YY.npy` arrays remain in the run directory, including NaN for invalid masked pixels. The API makes a same-name `.png` preview for each plane: finite values become opaque grayscale, non-finite values become transparent. Per-frame min/max normalization is display-only, not a physical color scale or VIL-to-rainfall conversion. `frames[].image_url` points to the PNG; `frames[].numeric_array_url` points to the preserved `.npy`; both are API routes. Bundle retrieval and artifact serving use restricted run-ID/filename patterns, path confinement, and the saved bundle's registered-URL allowlist.

ForecastBundle v1 fields are preserved: `schema_version`, `run_id`, `event_id`, `mode`, `forecast_method=persistence`, UTC times, supported leads, sources, model identity/checkpoint null, grid, frames, hazards and warnings. Unknown `grid.bounds_wgs84` remains null. Hail, lightning, downburst, cloudburst and storm-intensity proxy stay `unavailable` with `probability=null`; no calibrated risk, Indian geolocation, rainfall rate, learned-model claim, or six-hour horizon is inferred.

## Verification and limits

In an isolated combined checkout of the unmerged API, data and model branches, `pytest -q tests/api tests/hazards tests/models tests/data` passed 41 tests on Python 3.12.14 / NumPy 2.1.3. The API branch alone passed its six fixture/hazard tests while two cross-branch integration tests were skipped until the reviewed imports exist. A local HTTP smoke run consumed the live persistence API through dashboard PR #6's `fetchForecastBundle` helper: +30/+60 frames and both PNG/NumPy artifacts returned HTTP 200. No dashboard source change was required. One upstream FastAPI TestClient/httpx deprecation warning remains.

The generated Harinandana fixture is synthetic `demo_intensity` in arbitrary units, with `[12,32,32,1]` observed frames and null geography; it is not a real radar/satellite feed or validation dataset. The current path does not integrate EarthFormer, real sensors, calibrated hazards or georeferenced forecast skill. Run commands are in `docs/LOCAL_RUN.md`.
