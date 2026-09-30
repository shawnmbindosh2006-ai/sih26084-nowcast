# Manish status

Owner: @manishj2007

Role: Model integration and prototype coordinator

Current integration branch: `fix/devananda-api-integration`

Status: persistence/model PR #2 was approved by @shawnmbindosh2006-ai at
`669e873` and merged into `develop` at merge commit `4997022`. Backend takeover
PR #7 preserves Devananda's fixture API history, is reconciled with that merged
data/model baseline, and passes the full Python 3.11 baseline suite. No
learned-model implementation is included.

## Model/persistence checkpoint

- Implemented contract-v1 CPU persistence forecasting for `[T,H,W,C]` arrays.
- Added event, channel, timestamp, mask and supported-lead validation.
- `quality_mask=True` means valid; invalid forecast pixels are `NaN`; valid
  numeric zeros remain zero.
- Evaluation targets remain outside prediction.
- Added deterministic synthetic plumbing generation, model CLI and evaluation
  utilities for MAE, RMSE, CSI, POD and FAR.
- Forecast output remains labelled `forecast_method=persistence`.
- +90 minutes and longer model leads are rejected; the API exposes only +30 and
  +60 for persistence.

Model commits and PR:

- Initial implementation: `2227f39`.
- Mask behavior: `5659068`.
- Reviewed head: `669e873`.
- PR #2: https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/2
- Merged to `develop`: `4997022`.

Prior verified evidence:

- Python 3.11.9 / NumPy 2.1.3: 16/16 model/evaluation tests passed.
- Combined data + model checkout: 22/22 data and 16/16 model/evaluation tests
  passed.
- Independent Python 3.12 review: 38/38 combined tests passed.
- Harinandana's synthetic fixture produced `NaN` at the invalid final pixel for
  +30 and +60 while preserving all valid zeros.

## Data/model handshake

- Data PR #3 is merged into `develop` at `398e008`.
- Generated observation: `float32 [12,32,32,1]`, `demo_intensity` in
  `arbitrary_demo_units`, five-minute strictly increasing UTC cadence.
- Boolean quality mask: `[12,32,32,1]`, `True=valid`.
- Spacing, CRS and bounds are null and remain unknown.
- Four synthetic future frames are stored separately in
  `evaluation-targets.npy` and referenced only from evaluation metadata.
- A traced +30/+60 prediction opened only the observed array and quality mask.

## API integration takeover

Devananda's original fixture API commits and her five integration commits
through `e191bbb` remain in PR #7 history. Manish's takeover adds:

- optional validated EventBundle → observed-only persistence +30/+60;
- stable persistence run IDs;
- preserved numeric `.npy` forecast planes;
- PNG previews with transparent invalid pixels;
- API-served artifact URLs with path confinement;
- ForecastBundle v1 fields, unavailable/null hazards and null geography;
- separate synthetic +15 `forecast_method=fixture` behavior.

Takeover commits before develop reconciliation:

- `284766d` — integrate observed-only persistence nowcasts into API.
- `256697b` — reconcile Devananda API integration without rewriting history.

Prior API evidence:

- API-only branch: 6 tests passed, 2 dependency-gated integration tests skipped.
- Isolated combined data/model/API checkout: 42 tests passed on Python 3.12.14
  / NumPy 2.1.3.
- Local HTTP/dashboard-contract smoke fetched +30/+60 PNG and NumPy artifacts
  with HTTP 200.

## Scientific limits

- Persistence is not learned inference or evidence of weather skill.
- Synthetic fixtures are not observations.
- No Indian transfer, calibrated hazard probability, invented geography,
  rainfall-rate conversion or six-hour skill is claimed.
- EarthFormer, pySTEPS, LDCast, NWP blending and multimodal research remain out
  of scope for the baseline integration.

## Reconciled Python 3.11 validation (2026-09-30)

Environment: Python 3.11.9, NumPy 2.1.3, FastAPI 0.139.2, pytest 8.4.2 on
Windows. Exact results:

- `pytest -q tests/data`: 22 passed.
- `pytest -q tests/models tests/evaluation`: 16 passed.
- `pytest -q tests/api/test_api.py`: 6 passed, 1 warning.
- `pytest -q tests/hazards`: 1 passed.
- `pytest -q tests/api/test_persistence_integration.py`: 2 passed, 1 warning.
- Combined suite: 47 passed, 1 warning.

The warning is the existing Starlette/httpx TestClient deprecation notice. No
dependency-gated integration test skipped.

An actual local Uvicorn HTTP smoke verified all six contract routes, persistence
+30/+60, saved-bundle retrieval, and HTTP 200 for both PNG and NumPy artifacts.
+90/+180/+360 each returned 422. The returned bundle kept null CRS/bounds,
`forecast_method=persistence`, unavailable/null hazards and API-relative URLs.
Integration tests verified target-file absence during inference, NaN in `.npy`,
transparent invalid PNG pixels, opaque valid-zero pixels and traversal rejection.

## Current next step

Request peer review of PR #7. It is technically ready for merge consideration
after that review, but must not be merged automatically.

## Optical-flow upgrade branch (2026-09-30)

Branch `feature/manish-optical-flow` starts from accepted fallback baseline
`e4660e4`. It adds a separate `OpticalFlowNowcaster` using pySTEPS 1.21.5
Lucas--Kanade motion and semilagrangian advection for +30/+60 only. Persistence
is unchanged and remains the control and honest runtime fallback.

The provider reads the validated observed EventBundle boundary `[T,H,W,C]`
only. It preserves channel names/units, UTC valid times, grid/source provenance,
True=valid quality-mask semantics, invalid pixels as `NaN`, and valid numeric
zeros. Evaluation targets are not accepted by `predict()`.

Windows preflight found that PyPI distributes pySTEPS 1.21.5 as source and pip
requires MSVC 14+, which is absent on the test laptop. The verified path is the
official prebuilt conda-forge package in an isolated Python 3.11 environment;
the frozen pip persistence requirements were intentionally not changed. Setup,
interfaces and scientific limitations are recorded in `docs/OPTICAL_FLOW.md`.

Evaluation preparation adds a mask-aware named-method comparison for CSI, MAE
and RMSE. It records event, method, lead, threshold and valid sample counts.
No FSS was added, and no threshold was selected as evidence of superiority.

This branch does not expose optical flow through FastAPI or the dashboard and
does not change `docs/CONTRACT.md`. The `optical_flow` method identifier remains
a proposed coordinated contract extension for Devananda's method-routing work.
Real skill comparison waits on Harinandana's MRMS observations and separately
stored future truth; synthetic tests prove plumbing only.

## Final integration audit (2026-09-30)

The optical provider, data replay, method-routing API, and capability-driven
dashboard were reconciled on `integration/final-vajraview`. The API no longer
calls private `_load_pysteps()`; it uses public `optical_flow_readiness(event)`
and advertises optical flow only when both runtime and event prerequisites pass.
The provider accepts the MRMS timestamp jitter allowed by the loader.

Python 3.11 real-runtime testing used pySTEPS 1.21.5. The corrected archived
MRMS EventBundle ran through Lucas--Kanade/semilagrangian +30/+60 prediction with
dBZ preserved and NaN missingness retained. This is execution evidence only:
the available MRMS truth is +2/+4 minutes, so no +30/+60 skill comparison or
superiority claim is made.

Final suite: Python 3.11.9 fallback 64 passed / 1 expected skip; Python 3.11.16
with pySTEPS 1.21.5 65 passed; frontend 17 passed; Vite production build passed.
The Windows launcher started API/dashboard, served persistence +30/+60, and
Ctrl+C made both ports unreachable. Unix launcher validation was syntax-only.
