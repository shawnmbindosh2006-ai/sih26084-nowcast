# Devananda API integration status

Owner: @devanandabipin  
Role: Backend API and hazard evidence  
Branch: `feature/devananda-api`  
Pull request: [#5](https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/5), targeting `develop`; open and unmerged.

## Result

The metadata-only fixture endpoint and illustrative +15 minute PNG remain available. With `NOWCAST_EVENT_BUNDLE_PATH` pointing to a valid Harinandana EventBundle manifest, the same API also accepts +30 and +60 minute requests, calls Manish's CPU persistence adapter, and returns ForecastBundle v1. The adapter's numeric `.npy` fields remain unchanged, including NaN at invalid mask pixels. `image_url` points to a PNG rendering for browser display; the added `numeric_url` points to the original `.npy` artifact. Persistence run IDs retain the `persistence-` prefix. Unsupported leads are HTTP 422. All unsupported hazards are `unavailable` with `probability: null`.

## Exact local integration commands and result

In a local integration sandbox made from PR #5 source with the unmodified `src/nowcast/data/` module from PR #3 and `src/nowcast/models/` module from PR #2 overlaid:

```powershell
$env:PYTHONPATH = 'src'
.\.venv-win\Scripts\python.exe -m pytest -q tests --basetemp=.testtmp
```

Result: **7 passed, 1 warning in 0.70s** on Python 3.12.14, NumPy 2.1.3, FastAPI 0.139.2, pytest 8.4.2. The warning is Starlette's HTTPX TestClient deprecation notice. The new test runs `generate_fixture → load_event → PersistenceNowcaster → POST/GET API → PNG and .npy GET`, verifies both supported leads, PNG signatures/content types, numeric equality to the final observation, NaN at the masked pixel, fixture preservation, rejected 90-minute/fixture-30-minute requests, artifact confinement, and `unavailable`/null hazards.

## Remaining blockers and limitations

- PR #5 depends on PR #3 data and PR #2 model modules being available on `develop`; those modules were only overlaid for this local test and are not copied into Devananda's PR. Manish should review the interface and dependency order before integration. No remote CI result is claimed.
- The generated EventBundle is entirely synthetic and has no geographic bounds. Persistence simply repeats its final observed frame; it is not learned inference, calibrated hazard prediction, live nowcasting, or evidence of Indian transfer skill.
- The PNG uses a per-frame grayscale display stretch. It preserves missing pixels as transparency, but physical values and NaN semantics must be read from `.npy`.
- The EventBundle fixture and metadata-only fixture currently share `synthetic-demo-001`; the optional `forecast_method` chooses +15 persistence explicitly, while default +15 remains the illustrative fixture and default +30/+60 uses persistence. A distinct event ID should be introduced before adding real event inventory.
- Python 3.11 and a live browser-to-backend dashboard session have not been verified.

Next: Manish reviews PR #5's demonstrated integration; Shawn reviews the end-to-end result before any merge or next phase.
