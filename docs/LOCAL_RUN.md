# Local model run

These commands run the model checkpoint independently. The API and dashboard
modules are not yet present, so this is not the combined application launch.

## Windows PowerShell

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-model.txt
.\.venv\Scripts\python.exe scripts\generate-model-fixture.py
.\.venv\Scripts\python.exe scripts\run-persistence.py `
  runs\model-fixture\event.json --lead-minutes 30 60
$env:PYTHONPATH = (Join-Path (Get-Location) 'src')
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
```

If `py -3.11` is unavailable, invoke an existing Python 3.11 executable by its
full path. Do not install packages into the global interpreter.

## Linux or macOS shell

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-model.txt
.venv/bin/python scripts/generate-model-fixture.py
.venv/bin/python scripts/run-persistence.py \
  runs/model-fixture/event.json --lead-minutes 30 60
PYTHONPATH=src .venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

Generated arrays and forecast artifacts remain under the ignored `runs/`
directory. The forecast JSON labels the mode as synthetic and the method as
persistence, uses null geography, and marks hazards unavailable.

Running against `fixtures/demo-event.json` must fail with a metadata-only fixture
error. That is an intentional readiness check, not a reason to fabricate an
array.

## Evaluation command

Use only when prediction and genuinely observed future-target arrays share the
same shape with lead time on axis 0:

```powershell
.\.venv\Scripts\python.exe scripts\evaluate-arrays.py `
  <prediction.npy> <target.npy> --lead-minutes 30 60 `
  --threshold <documented-threshold> --variable <name> --units <units>
```

The integrated `scripts/start-demo.ps1` and `scripts/start-demo.sh` remain
blocked until the API and dashboard branches provide verified start commands and
readiness endpoints. This model checkpoint does not invent those modules.
