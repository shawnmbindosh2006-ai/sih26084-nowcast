# Local persistence model and API run

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

## Integrated EventBundle persistence API

Generate a fresh Harinandana fixture path; the generator will not overwrite an
existing fixture:

```powershell
.\.venv\Scripts\python.exe -m nowcast.data generate runs/integration-fixture
$env:NOWCAST_EVENT_BUNDLE_PATH = (Resolve-Path runs/integration-fixture/event.json).Path
$env:NOWCAST_RUNS_DIR = Join-Path (Get-Location) 'runs/api'
.\.venv\Scripts\python.exe -m uvicorn nowcast.api.app:app --host 127.0.0.1 --port 8000
```

`NOWCAST_EVENT_PATH` is also accepted. In another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/capabilities
Invoke-RestMethod http://127.0.0.1:8000/api/v1/events
$body = '{"event_id":"persistence:synthetic-demo-001","lead_times_minutes":[30,60]}'
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

The final cross-platform launcher is tracked separately in PR #9 and is not
integrated by these commands. No real data, learned model, calibrated hazard,
rainfall-rate conversion or Indian forecast skill is provided.
