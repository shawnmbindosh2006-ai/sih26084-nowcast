# Harinandana status

Owner: @bluebvrrie
Role: Data ingestion and sensor harmonisation
Branch: feature/harinandana-data

Status: synthetic/SEVIR work retained; bounded NOAA MRMS archived replay implemented
and locally verified. Peer integration review required; scientific validation unavailable.

Done:
- Added observed-only `load_event(path)` returning EventBundle v1 as a dictionary.
- Deterministic synthetic generator, separate evaluation targets, boolean valid
  masks, timestamps, dimensions, units, geography and cadence checks.
- Preserved original fixture illustration and all model/API/shared paths.
- Bounded SEVIR probe and committed catalog/object provenance manifests.
- Indian adapter stubs and primary-source access/calibration plan documented.
- Added a fixed six-file NOAA MRMS CONUS archived replay: four observed frames,
  two separate future-truth frames, dBZ reflectivity, native-grid crop, quality
  mask and generated object/output checksum manifest. No raw data is committed.

Commit and PR:
- Implementation checkpoint a974c2b03c24b8b068fa14defe0bf4e249aa2c4b pushed and
  verified against origin/feature/harinandana-data.
- Draft PR https://github.com/shawnmbindosh2006-ai/sih26084-nowcast/pull/3 verified
  open, base develop, head feature/harinandana-data. Not merged.
- This handoff-only follow-up records the verified PR; implementation checks
  above apply to a974c2b. No code changed after those checks.
Base: origin/develop at ea2fb4b31150397b157aff6e16065f6f362ffb60.
Task: Harinandana data ingestion assignment in docs/prompts/harinandana.txt.

Exact commands executed (Windows PowerShell, repository root):

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) 'src'
$dataPython = 'C:\Users\asros\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $dataPython -m nowcast.data generate runs/data-fixture
& $dataPython -m unittest discover -s tests/data -v
& $dataPython -m nowcast.data.sevir runs/sevir-public-probe --download
& $dataPython -m pip install --target runs/mrms-python eccodes==2.48.0
$env:PYTHONPATH = (Join-Path (Get-Location) 'runs/mrms-python') + ';' + (Join-Path (Get-Location) 'src')
& $dataPython -m nowcast.data.mrms runs/mrms-replay-complete
& $dataPython -m nowcast.data validate runs/mrms-replay-complete/event.json
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
- MRMS replay completed from the public `noaa-mrms-pds` bucket on 2026-09-30.
  Six compressed GRIB2 objects total 7,279,135 bytes, below the 10,000,000-byte
  ceiling. The generated manifest records source URLs and SHA256 values.
- Loaded event: `[4,128,128,1]`, `reflectivity` / `dBZ`, source UTC
  2020-10-14T00:00:22Z–00:06:31Z; future truth is separately stored for
  00:08:32Z and 00:10:27Z. Grid is genuine CONUS EPSG:4326 crop bounds
  [-95.635, 36.865, -94.365, 38.135]; native spacing remains null because MRMS
  declares an angular 0.01-degree grid and no km conversion is invented.
- `python -m nowcast.data validate runs/mrms-replay-complete/event.json` passed;
  24/24 data tests passed in 0.699 s on Python 3.12.14 / NumPy 2.3.5.

Blockers and limitations:
- The MRMS replay is US archived data only. It supports ingestion/integration
  evidence, not Indian transfer, real-time operation, forecast skill or hazards.
- The selected SEVIR HDF5 remains over budget. No request to increase budget or
  purchase/access accounts was made.
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
  connector) and PR creation returned 404. Local Git credentials successfully
  pushed and created/verified the draft PR through GitHub's REST API. No
  credentials were printed or saved. The PR links the repository task prompt.

Next step: Manish reviews `reflectivity`/`dBZ` and mask handling, reconciles the
optional ecCodes environment, runs target Python 3.11 checks and coordinates the
model/API handoff. No ETA for Indian feeds or scientific validation.

## Final integration audit correction (2026-09-30)

The original download/decoder path and observation/target separation were
retained. Independent inspection found that the source-grid centre crop was
entirely the product's `-99 dBZ` missing sentinel, which ecCodes did not mark via
its generic missing-value key. Integration now applies NOAA's documented `-99`
missing and `-999` no-coverage values and uses a fixed 128x128 crop recorded as
row 906 / column 4455. The crop was selected from the first observed frame only;
future targets were not consulted. A real six-object decode produced
`[4,128,128,1]`, 39.45% valid cells, and valid reflectivity from -4.5 to 62 dBZ.

The future frames are approximately +2.02/+3.93 minutes, not +30/+60. They remain
separate from inference and can support short-horizon plumbing checks only. No
+30/+60 MRMS skill result is claimed.
