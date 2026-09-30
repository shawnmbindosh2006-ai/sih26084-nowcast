# Local VajraVIEW baseline run

Python 3.11 is the project target. Run commands from the repository root in an
isolated virtual environment; do not install packages globally.

## Windows PowerShell setup

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-app.txt
$env:PYTHONPATH = (Resolve-Path src).Path
```

`requirements-app.txt` includes the API runtime and compatible numeric
dependencies for the merged data/model path.

## Independent model checkpoint

```powershell
.\.venv\Scripts\python.exe scripts\generate-model-fixture.py
.\.venv\Scripts\python.exe scripts\run-persistence.py `
  runs\model-fixture\event.json --lead-minutes 30 60
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
```

The generated forecast is synthetic persistence with null geography and
unavailable hazards. Running against `fixtures/demo-event.json` must fail with
the expected metadata-only fixture error.

## One-command Windows demo

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
```

The launcher builds the dashboard and serves the dependency-free persistence
fallback at `http://127.0.0.1:8000` with the UI at
`http://127.0.0.1:5173`. Ctrl+C stops both process trees. This pip environment
does not advertise optical flow because Windows PyPI installation requires a
compiler that is not assumed on a clean demo laptop.

## Integrated EventBundle persistence API

Use the same validated demo EventBundle path as the Windows launcher. Generate
it only when it does not already exist; the generator intentionally will not
overwrite an existing fixture:

```powershell
$env:PYTHONPATH = (Resolve-Path src).Path
if (-not (Test-Path runs/demo-event/event.json)) {
  .\.venv\Scripts\python.exe -m nowcast.data generate runs/demo-event
}
.\.venv\Scripts\python.exe -m nowcast.data validate runs/demo-event/event.json
$env:NOWCAST_EVENT_BUNDLE_PATH = (Resolve-Path runs/demo-event/event.json).Path
$env:NOWCAST_RUNS_DIR = Join-Path (Get-Location) 'runs/api'
.\.venv\Scripts\python.exe -m uvicorn nowcast.api.app:app --host 127.0.0.1 --port 8000
```

An explicitly configured missing or invalid EventBundle is a startup
misconfiguration and `/api/v1/capabilities` returns HTTP 503. To run the
illustrative fixture-only path, remove both EventBundle variables before
starting the API:

```powershell
Remove-Item Env:NOWCAST_EVENT_BUNDLE_PATH, Env:NOWCAST_EVENT_PATH -ErrorAction SilentlyContinue
```

`NOWCAST_EVENT_PATH` is also accepted. In another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/capabilities
Invoke-RestMethod http://127.0.0.1:8000/api/v1/events
$body = '{"event_id":"persistence:synthetic-demo-001","lead_times_minutes":[30,60],"forecast_method":"persistence"}'
$bundle = Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/nowcasts `
  -ContentType 'application/json' -Body $body
$bundle.frames | Select-Object lead_minutes,valid_time_utc,image_url,numeric_array_url,variable,units
```

`image_url` is a display PNG and `numeric_array_url` is the unchanged NumPy
plane. Prefix each relative URL with `http://127.0.0.1:8000` to retrieve it.
`GET /api/v1/nowcasts/{run_id}` returns the saved bundle. The original
`synthetic-demo-001` fixture remains a separate +15 `forecast_method=fixture`
path.

## Optional optical-flow runtime

Use the pinned conda-forge environment because its Windows pySTEPS package is
prebuilt:

```powershell
conda env create -f environment-optical-flow.yml
conda activate vajraview-optical-flow
$env:PYTHONPATH = (Resolve-Path src).Path
python -m nowcast.data generate runs/optical-event
$env:NOWCAST_EVENT_BUNDLE_PATH = (Resolve-Path runs/optical-event/event.json).Path
$env:NOWCAST_RUNS_DIR = Join-Path (Get-Location) 'runs/optical-api'
python -m uvicorn nowcast.api.app:app --host 127.0.0.1 --port 8000
```

When the public runtime/event readiness check succeeds, capabilities adds
`optical_flow` with +30/+60. An explicit optical-flow request never silently
falls back to persistence. Runtime failures return HTTP 503; unavailable or
unsupported selections return HTTP 422.

In a second shell, run `npm ci` and `npm run dev` under `web/`. The dashboard
discovers methods/events from the API and sends `forecast_method` explicitly.

## Full baseline verification

```powershell
$env:PYTHONPATH = (Resolve-Path src).Path
.\.venv\Scripts\python.exe -m pytest -q `
  tests/data tests/models tests/evaluation tests/api tests/hazards
```

The persistence integration tests exercise the EventBundle → model → API →
ForecastBundle → `.npy`/PNG path. Unsupported +90/+180/+360 requests must fail.

## Evaluation command

Use only when prediction and genuinely observed future targets have the same
shape with lead time on axis 0:

```powershell
.\.venv\Scripts\python.exe scripts\evaluate-arrays.py `
  <prediction.npy> <target.npy> --lead-minutes 30 60 `
  --threshold <documented-threshold> --variable <name> --units <units>
```

Prediction and target paths must remain separate. Exclude masked/nonfinite
pixels according to the documented evaluation procedure.

## Linux or macOS verification

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-app.txt
PYTHONPATH=src .venv/bin/python -m pytest -q \
  tests/data tests/models tests/evaluation tests/api tests/hazards
```

The Unix launcher is syntax-checked but must not be described as Linux-tested
unless it is actually executed on Linux. No learned model, calibrated hazard,
rainfall-rate conversion or Indian forecast skill is provided.
