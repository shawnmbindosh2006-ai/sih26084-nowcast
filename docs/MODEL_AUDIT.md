# Model audit

Audit date: 2026-09-29

## Current decision

The runnable model path is the CPU persistence baseline. It repeats the final
observed frame and is labelled `forecast_method="persistence"`. It is not AI
inference and has no weather-skill claim.

Earthformer SEVIR remains a candidate, not an integrated model. The official
checkpoint could not be retrieved from its documented endpoint, so no adapter,
runtime, memory, or compatibility claim is made.

## Earthformer SEVIR candidate

- Official source: https://github.com/amazon-science/earth-forecasting-transformer
- Source commit inspected: `7732b03bdb366110563516c3502315deab4c2026`
- Configuration: `scripts/cuboid_transformer/sevir/earthformer_sevir_v1.yaml`
- Code license: Apache-2.0 in the official repository.
- Checkpoint identifier: `earthformer_sevir.pt`
- Documented source: `s3://earthformer/pretrained_checkpoints/earthformer_sevir.pt`
- HTTPS link exposed by the official README:
  `https://earthformer.s3.amazonaws.com/pretrained_checkpoints/earthformer_sevir.pt`
- Checkpoint access on 2026-09-29: HTTP 403 for both HEAD and GET attempts.
- Checkpoint terms: no separate terms were located next to the official link.
  Code licensing is not assumed to grant weight rights.
- Checkpoint SHA256: unavailable because no checkpoint was downloaded.

The verified config uses one VIL channel with layout `NTHWC`, input shape
`[13,384,384,1]`, target shape `[12,384,384,1]`, and five-minute cadence. It
therefore consumes 65 minutes of history and produces at most 60 minutes of
VIL output. The official training script selects `rescale_method="01"`; the
loader converts raw `uint8` VIL to `float32` by multiplying by `1/255` and
inverts with multiplication by 255.

The official README recommends Python 3.9 and documents PyTorch 1.12.1 with
CUDA 11.6 or PyTorch 1.13.1 with CUDA 11.7, PyTorch Lightning 1.6.4, xarray,
netCDF4, OpenCV, earthnet 0.3.9, and NVIDIA Apex. Those legacy GPU dependencies
were not added to the Python 3.11 CPU application environment.

Device, inference runtime, and inference memory are unmeasured because model
loading cannot be verified without an authorized checkpoint. No SEVIR dataset,
checkpoint, CUDA package, or Earthformer source tree was downloaded into this
repository.

## Scientific limits

Earthformer SEVIR is a United States VIL benchmark. VIL is not rainfall in
mm/hour. Successful inference would not validate Indian transfer, 1–3 km skill,
hail probability, lightning density, downburst velocity, cloudburst probability,
or any 90-minute to six-hour forecast. Those outputs remain unavailable until
supported by appropriate data and validation.

## Reproduction evidence

Source commit verification:

```powershell
git ls-remote https://github.com/amazon-science/earth-forecasting-transformer.git HEAD
```

Observed result:

```text
7732b03bdb366110563516c3502315deab4c2026  HEAD
```

Checkpoint access test:

```powershell
Invoke-WebRequest -Method Head -UseBasicParsing `
  https://earthformer.s3.amazonaws.com/pretrained_checkpoints/earthformer_sevir.pt
```

Observed result: HTTP 403 Forbidden. The next model step is to obtain an
owner-approved, terms-cleared official checkpoint source and verify its SHA256
before installing the isolated legacy stack.
