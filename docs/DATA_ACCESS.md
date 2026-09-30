# Data ingestion: run and access guide

## Implemented locally

From repository root, with Python 3.11 installed:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r configs/data/requirements.txt
$env:PYTHONPATH = Join-Path (Get-Location) 'src'
.\.venv\Scripts\python.exe -m nowcast.data generate runs/data-fixture
.\.venv\Scripts\python.exe -m nowcast.data validate runs/data-fixture/event.json
.\.venv\Scripts\python.exe -m unittest discover -s tests/data -v
```

Use a new output directory for each generation. `fixtures/demo-event.json`
remains the original metadata illustration and correctly fails loading because
it has no array. No other contributor's code or shared dependencies are changed.

```python
from nowcast.data import load_event
event = load_event('runs/data-fixture/event.json',
                   expected_channels={'demo_intensity': 'arbitrary_demo_units'},
                   expected_cadence_seconds=300)
# Pass this dictionary to the model/API integration, after peer review.
```

The loader validates regular cadence, strictly increasing explicit UTC times,
last-observation time, real numeric dimensions, masks, source provenance,
channel/unit lengths and known units, bounds and resampling provenance.
Specify expected channels for consumer-specific units; unknown channel names
are preserved and do not receive invented physical meanings. With no expected
cadence, cadence is inferred from the first interval: uniform undersampling
cannot be detected. Null geography remains usable in image view.

## SEVIR: bounded investigation

```powershell
.\.venv\Scripts\python.exe -m nowcast.data.sevir runs/sevir-probe --download
```

Default event `S858968` comes from the original tutorial. The probe HEADs the AWS
catalog, downloads it within budget, selects its VIL row, records the HDF5 key
and row, and HEADs the full container before any data download. It never assumes
that selecting one event reduces container transfer size. The default total
budget is 1,000,000,000 bytes, including the catalog; `--budget-bytes` can lower
it. Larger budgets require Manish's approval and reviewed code/config change.
Without `--download`, only the catalog is fetched and the container inspected.
Each invocation is a separate budget; do not repeatedly fetch as a workaround.

SHA256 is computed only for actual complete downloads. Unknown object sizes,
access errors and over-budget containers preserve `manifest.json` and leave
synthetic mode usable. Partial downloads are retained as evidence, never marked
complete. No credentials, account purchase or bulk bucket sync is required for
the public AWS source. HDF5 conversion awaits a permitted bounded sample and
approved checkpoint preprocessing; this command does not produce a replay bundle.

Investigation result: catalog 33,838,047 bytes (downloaded and hashed); selected
VIL container 3,908,920,610 bytes (HEAD only, download blocked by budget).
See `configs/data/sevir-manifest.json`. No HDF5 data was fetched.

## NOAA MRMS archived replay

The MRMS command fetches one fixed, six-frame, public CONUS sequence of
`MergedReflectivityQCComposite_00.50` files from 2020-10-14. It is US archived
replay data, not a live feed, an Indian observation, precipitation, or a
forecast. The product carries reflectivity in `dBZ`, which remains its channel
unit. Four frames become observed input and the following two become archived
future truth in a separate file.

```powershell
.\.venv\Scripts\python.exe -m pip install -r configs/data/requirements-mrms.txt
$env:PYTHONPATH = Join-Path (Get-Location) 'src'
.\.venv\Scripts\python.exe -m nowcast.data.mrms runs/mrms-replay
.\.venv\Scripts\python.exe -m nowcast.data validate runs/mrms-replay/event.json
```

The default total compressed download ceiling is 10,000,000 bytes. The command
HEADs every object before transfer, rejects a sequence beyond that ceiling, and
records object URLs, sizes, SHA256 values, timestamps, output hashes and crop
metadata in `runs/mrms-replay/manifest.json`. The raw GRIB2 files and generated
arrays are intentionally ignored by Git. `configs/data/mrms-replay.json` records
the fixed selection and budget without pretending those values are downloaded.

GRIB2 decoding uses optional `eccodes`; it retains missing bitmap/sentinel values
in a boolean mask (`True=valid`) and stores a zero placeholder only where the mask
is false. The output is a 128x128 native-grid crop with no resampling. Its WGS84
bounds, row/column start, angular increments, scan direction and full-grid shape
come from GRIB metadata. `native_spacing_km` stays null because the product grid
is angular and this module does not invent a kilometre spacing. `evaluation.json`
is deliberately excluded by `load_event` and inference consumers.

The loader preserves MRMS source seconds. When callers do not declare an exact
cadence, it derives the median interval and permits at most 30 seconds of source
timestamp jitter; larger gaps still fail. Supplying `expected_cadence_seconds`
keeps exact cadence validation.

## India adapter path (primary documentation checked 2026-09-29)

All three adapters in `nowcast.data.india` explicitly return unavailable source
status and raise on loading. No permitted real sample or feed credential has
been supplied. These are access/integration blockers, not evidence that the
services themselves are offline. Synthetic integration remains usable; real
replay loading requires a properly prepared observed artifact.

| Source | Current primary evidence | Required next step |
|---|---|---|
| MOSDAC INSAT | [INSAT-3D](https://www.mosdac.gov.in/insat-3d) describes calibrated, geolocated L1B processing. [Ordering guidance](https://staging.mosdac.gov.in/node/2057) describes credentialed satellite orders and SFTP delivery. | Obtain permitted sample, exact product/version and redistribution terms through Manish; do not assume L1C. |
| IMD DWR | [Radar services](https://mausam.imd.gov.in/responsive/radar.php?lang=en) publishes product images and historical-data contact; [data supply contact](https://radarapi.imd.gov.in/dsp/frontend/contact) handles requests. | Obtain native reflectivity/velocity volumes, format documentation and terms. Rendered radar imagery is not a quantitative volume. |
| Lightning | [IMD API index](https://api.imd.gov.in/public/api_reference.html) lists lightning data and radar imagery; [access portal](https://api.imd.gov.in/public/index.php) offers registration/login. | Confirm actual endpoint authorization, schema, event timing, detection type, coverage, quality flags and terms before coding a reader. Public index presence is not verified feed access. |

Reader acceptance procedure:

1. Preserve raw file, source URL/product ID, acquisition and observation UTC,
   terms, checksum and native dimensions. Verify time basis from product metadata.
2. Apply documented product-specific calibration/LUT and fill/quality flags.
   INSAT thermal brightness temperature, reflectivity in dBZ and radial velocity
   in m/s remain distinct channels. Confirm units from the actual product.
3. Recover per-pixel geolocation/projection and orientation; account for scan
   timing and missing navigation. Do not invent a bounding box or 1–3 km grid.
4. Align only observed intervals with declared tolerances and no future leakage.
   Preserve native arrays; record any target grid, method, source resolution and
   interpolation/aggregation masks separately. Lightning counts require an
   explicit time window, area definition and coverage before density estimation.
5. Agree model channel mapping with Manish through review. INSAT cannot feed a
   VIL-only or GOES-trained model without separately validated adaptation. Indian
   forecast and hazard validation remain unavailable.
