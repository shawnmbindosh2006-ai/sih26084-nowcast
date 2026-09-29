# Harinandana status

Owner: @bluebvrrie
Role: Data ingestion and sensor harmonisation
Branch: feature/harinandana-data

Status: fixture/loader implemented; source investigation complete within budget;
peer integration review required. Scientific validation unavailable.

Done:
- Added observed-only `load_event(path)` returning EventBundle v1 as a dictionary.
- Deterministic synthetic generator, separate evaluation targets, boolean valid
  masks, timestamps, dimensions, units, geography and cadence checks.
- Preserved original fixture illustration and all model/API/shared paths.
- Bounded SEVIR probe and committed catalog/object provenance manifests.
- Indian adapter stubs and primary-source access/calibration plan documented.

Commit and PR: implementation checkpoint pending; will record verified push/PR.
Base: origin/develop at ea2fb4b31150397b157aff6e16065f6f362ffb60.
Task: Harinandana data ingestion assignment in docs/prompts/harinandana.txt.

Exact commands executed (Windows PowerShell, repository root):

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'src'
$dataPython = 'C:\Users\asros\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $dataPython -m nowcast.data generate runs/data-fixture
& $dataPython -m unittest discover -s tests/data -v
& $dataPython -m nowcast.data.sevir runs/sevir-public-probe --download
```

Evidence and checks:
- Python 3.12.14, NumPy 2.3.5: 22/22 tests passed in 0.477 s.
- Application target remains Python 3.11 / NumPy 2.1.3; see DATA_ACCESS.md for
  target-environment setup. No Python 3.11 is registered locally (`py -0p`), so
  target-runtime execution is unverified; dependencies are not installed globally.
- Fixture shape [12,32,32,1], demo_intensity/arbitrary_demo_units, synthetic UTC
  2026-01-01 00:00–00:55 at 300-second cadence; no genuine geography or spacing.
- Observed SHA256 ce62b73e0788abe1017e345ebfbd84f5a14e6b6d8660d09f4f0b317b6a54141b.
  Full array/JSON checksums in configs/data/synthetic-provenance.json.
- SEVIR S858968 catalog downloaded (33,838,047 bytes), SHA256
  3209386cde96ffa80ccec3c1919090ffc601333cc651116f9fc48f224a5c2f57.
  Container data/vil/2019/SEVIR_VIL_STORMEVENTS_2019_0701_1231.h5 at index 421
  is 3,908,920,610 bytes. HEAD only; blocked by 1 GB budget. Container checksum
  remains null. See configs/data/sevir-manifest.json for the exact row and URL.

Blockers and limitations:
- No inference-ready real replay event: selected HDF5 is over budget. No request
  to increase budget or purchase/access accounts was made.
- No approved checkpoint/terms/hash: learned normalization remains unimplemented,
  raw representation stays explicit; no VIL-to-rainfall or hazard claim.
- Indian readers remain unavailable pending permitted samples, terms, calibration
  and mapping review. No Indian performance or live-feed claim.
- `True=valid` mask convention requires peer integration review. Manish's branch
  currently checks masks but does not apply them to persistence outputs; downstream
  missing-pixel behavior must be agreed before demonstration.
- Shared integration was inspected read-only at model branch b2b7cff; not merged
  or executed. API/dashboard end-to-end checks are outside this module checkpoint.
- GitHub connector issue search returned 422 (repository inaccessible to that
  connector); Git remote fetch succeeded through local Git credentials.

Next step: Manish reviews mask/channel conventions and dependency reconciliation,
runs target Python 3.11 checks and coordinates the model/API handoff. No ETA for
real feeds or scientific validation while access/checkpoint dependencies remain.
