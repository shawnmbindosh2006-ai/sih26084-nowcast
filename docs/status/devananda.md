# Devananda API integration status

Owner: @devanandabipin
Role: Backend API and hazard evidence
Branch: `feature/devananda-api`
Pull request: [#5](https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/5), targeting `develop`; open and unmerged.

## Earlier fixture handoff (historical)
Status: implementation complete locally; branch feature/devananda-api based on origin/develop
Done:
- Added FastAPI health, capabilities, event inventory, synchronous nowcast creation/retrieval, and restricted PNG artifact endpoints.
- Added conservative hazard evidence: all hazards unavailable, probabilities null, empty WGS84 FeatureCollections, and no arrival estimates because the fixture has no observations/geography.
- Kept synthetic fixture output explicitly illustrative. PNG is a neutral placeholder and contains no meteorological field.
- Added endpoint and hazard tests covering malformed and unsupported leads, unknown events, unavailable hazards, persisted retrieval, and artifact path confinement.
Commit and PR: implementation checkpoint `ce857079a1ba9815a33c770720e18bc58b1b4d9e`; current pushed branch head `465d2ac` (API sample and handoff provenance). Both are on `origin/feature/devananda-api`. PR not created. GitHub offered https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/new/feature/devananda-api, but the available browser session is signed out and the private repo page returned 404. `gh` is not installed. No PR number or link is claimed.
Run command: `$env:PYTHONPATH='src'; uvicorn nowcast.api.app:app --reload` (PowerShell). Smoke: POST `http://127.0.0.1:8000/api/v1/nowcasts` with `{"event_id":"synthetic-demo-001","lead_times_minutes":[15]}`.
Evidence and tests: fixture provenance is `fixtures/demo-event.json` (synthetic, metadata only, `observed_array_path: null`, unknown grid bounds); no external data or checkpoint. Smoke POST returned HTTP 201 and run `c2bab23ebb6c483cabbd2fb7143de7b5`; artifact returned HTTP 200 and PNG signature. `pytest -q tests/api tests/hazards` — 6 passed. `git diff --check` passed before commit. Shared environment versions observed: Python 3.13.9, FastAPI 0.139.2, Pydantic 2.13.4, Uvicorn 0.51.0, pytest 8.4.2, httpx 0.28.1.
Limitations: starter event is metadata-only. No weather forecast, calibrated proxy, hazards, sensor freshness measurement, geolocation, or real arrival estimate is produced. Supported 15-minute frame is labeled illustrative; 90/180/360-minute leads are rejected. No Python 3.11 environment was available for verification. HTTPX emits a Starlette TestClient deprecation warning in this environment.
Blocker: no local develop branch, so feature branch tracks origin/develop. Push/PR needs GitHub credentials/network and has not been attempted.
Next step: review interface names with Anamika/Manish, then commit and open a PR to develop after coordinated review.

## Manish takeover note (2026-09-30)

The preceding handoff is preserved as Devananda wrote it. Since then, her branch head is `7aab5818b3b46d3c7d7a1c4e6b73bcedb3d1ffc7` and PR #5 is open against `develop`: https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/5. The earlier "no PR" wording above is historical, not current status. Manish is adding the observed-only persistence integration on a separate `fix/devananda-api-integration` branch; Devananda's original commits and fixture +15 implementation remain intact. No PR has been merged by this takeover work.
## Devananda's later persistence integration handoff (PR #5)
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

## Manish takeover reconciliation (2026-09-30)

PR #5 advanced to `e191bbba6f2ed4e6087a282a2f94d2e65891276d` while the API takeover branch was being prepared. Its commits are merged into `fix/devananda-api-integration` without rewriting Devananda's history. The takeover keeps the validated +30/+60 persistence path and original +15 fixture separate, uses a distinct public persistence event alias for dashboard discovery, preserves PR #5's `NOWCAST_EVENT_BUNDLE_PATH` and `numeric_url` compatibility, and adds registered-artifact confinement and deeper mask tests. PR #7 is a draft into `develop`; neither PR is merged. PRs #2 and #3 remain dependencies.
