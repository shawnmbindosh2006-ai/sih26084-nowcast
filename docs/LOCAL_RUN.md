# Local fixture and persistence API run

Run these commands from the repository root **after** the reviewed data (PR #3) and model (PR #2) modules are available alongside this API branch. Use a fresh `runs/integration-fixture` path; Harinandana's generator will not overwrite an existing fixture. Python 3.11 is the project target; this integration was also tested with Python 3.12.14.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-app.txt
$env:PYTHONPATH = (Resolve-Path src).Path
.\.venv\Scripts\python.exe -m nowcast.data generate runs/integration-fixture
$env:NOWCAST_EVENT_PATH = (Resolve-Path runs/integration-fixture/event.json).Path
$env:NOWCAST_RUNS_DIR = Join-Path (Get-Location) 'runs/api'
.\.venv\Scripts\python.exe -m uvicorn nowcast.api.app:app --host 127.0.0.1 --port 8000
```

In another PowerShell window, use the same `NOWCAST_EVENT_PATH` and `NOWCAST_RUNS_DIR` values for any direct Python checks. The API calls below discover the event without requiring those variables in the client shell:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/capabilities
Invoke-RestMethod http://127.0.0.1:8000/api/v1/events
$body = '{"event_id":"persistence:synthetic-demo-001","lead_times_minutes":[30,60]}'
$bundle = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/nowcasts -ContentType 'application/json' -Body $body
$bundle.frames | Select-Object lead_minutes,valid_time_utc,image_url,numeric_array_url,variable,units
```

`image_url` is a display PNG, while `numeric_array_url` is the unchanged NumPy plane. Both are relative `/api/v1/artifacts/{run_id}/{filename}` URLs; prefix them with `http://127.0.0.1:8000` to retrieve them. `GET /api/v1/nowcasts/{run_id}` returns the saved bundle. The original `synthetic-demo-001` fixture still accepts only `[15]` and remains `forecast_method=fixture`.

With dashboard PR #6 available, set `VITE_API_BASE_URL=http://127.0.0.1:8000` in `web/.env`, then run `npm ci` and `npm run dev` from `web/`. The dashboard uses capabilities and the first advertised event, so it selects the configured persistence path; null bounds produce an image view, not a map placement.

To verify after dependencies land:

```powershell
$env:PYTHONPATH = (Resolve-Path src).Path
.\.venv\Scripts\python.exe -m pytest -q tests/api tests/hazards tests/models tests/data
```

Without `NOWCAST_EVENT_PATH`, the API runs only Devananda's original synthetic +15 placeholder. No real data, learned model, calibrated hazard, rainfall-rate mapping or Indian forecast skill is provided by these commands.
