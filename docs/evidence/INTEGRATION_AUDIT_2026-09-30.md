# Independent local integration audit — 2026-09-30

Shawn assembled downloaded snapshots of PR #7 API, PR #2 model, PR #3 data and PR #6 dashboard in an isolated local directory. These branches were not merged by this test. All event values were deterministic synthetic data with unknown geography.

## Reproduction

Host: Windows; Python 3.12.14; Node 24.20.0. Branch ZIPs came from the signed-in GitHub UI because the private Git remote was not authenticated in the shell.

From the assembled root: create a venv, install requirements-app.txt, set PYTHONPATH=src, run pytest on tests/api tests/hazards tests/models tests/data, generate a fresh fixture with python -m nowcast.data generate runs/integration-fixture, set NOWCAST_EVENT_BUNDLE_PATH to that event.json and NOWCAST_RUNS_DIR to runs/api, then start uvicorn nowcast.api.app:app on 127.0.0.1:8010. In web/: run npm ci, npm test, npm run build; set VITE_API_BASE_URL=http://127.0.0.1:8010 and preview the built app on 127.0.0.1:5173.

## Observed results

- Python suite: 42 passed, one upstream TestClient deprecation warning. Exit code 0. Pytest also printed a Windows temp-directory permission error during process exit after the passing result.
- Dashboard: 4 tests passed; production build passed with 70 modules transformed.
- API advertised distinct persistence:synthetic-demo-001 and synthetic-demo-001 events. Persistence capabilities offered only +30/+60. A POST for +30/+60 returned HTTP 201, persistence method, prefixed run ID and two frames. The +15 fixture stayed fixture mode. +90 returned 422.
- Both PNG and numeric NumPy artifact URLs returned HTTP 200. The +60 plane was float32 32x32; its one masked pixel remained NaN, 16 valid zero pixels remained zero, and all valid pixels equalled the final observed frame.
- All five hazards had status unavailable and probability null.
- The production dashboard loaded from the API, displayed SYNTHETIC / PERSISTENCE / API, allowed +30 and +60, loaded the PNG image at 32x32, and did not invent map placement or an arrival time.

The first npm ci failed on the restricted global cache; a workspace-local npm cache succeeded. Vite development dependency prebundling hit a workspace access error, while the production build and preview worked. These are local environment findings. API online means the local server was reachable, not that real feeds were connected.

## Remaining gates

PRs #2, #3, #6 and #7 still need reviewed integration into develop. Run the tests again from the resulting develop checkout, add and verify start-demo.ps1/.sh, and obtain the owner review required before any main/release change. The overlapping legacy PR #5 needs explicit disposition. This audit does not demonstrate learned inference, real-data metrics, Indian validation, calibrated hazards, or six-hour forecasts.
