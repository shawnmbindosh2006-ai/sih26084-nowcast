# Optical-flow provider

This branch adds an observed-only deterministic motion baseline alongside the
frozen persistence baseline. It uses pySTEPS 1.21.5 Lucas--Kanade dense motion
and semilagrangian extrapolation for +30 and +60 minutes.

Primary implementation references:

- official repository (BSD-3-Clause): <https://github.com/pySTEPS/pysteps>
- Lucas--Kanade API: <https://pysteps.readthedocs.io/en/stable/generated/pysteps.motion.lucaskanade.dense_lucaskanade.html>
- semilagrangian API: <https://pysteps.readthedocs.io/en/stable/generated/pysteps.extrapolation.semilagrangian.extrapolate.html>
- official conda-forge package: <https://anaconda.org/conda-forge/pysteps>

## Environment

Python 3.11 is supported. On Windows, the PyPI release is source-only and
requires Microsoft Visual C++ 14 or newer to compile pySTEPS' Cython
extensions. The verified Windows path is the prebuilt conda-forge package:

```powershell
conda env create -f environment-optical-flow.yml
conda activate vajraview-optical-flow
$env:PYTHONPATH = "src"
python -m pytest -q tests/models tests/evaluation
```

The preflight on 30 September 2026 used Python 3.11.16 and pySTEPS 1.21.5 from
conda-forge. A normal `pip install pysteps==1.21.5` failed on the test laptop
because MSVC was not installed. `requirements-model.txt` is deliberately left
unchanged so the accepted pip-based persistence fallback and launcher are not
broken by this optional provider.

## Provider boundary

```text
EventBundle [T,H,W,C]
  -> validate observed path, UTC cadence, channels, units, grid and mask
  -> take the most recent observed frames only
  -> estimate per-channel Lucas--Kanade velocity [2,H,W]
  -> semilagrangian advection to lead/cadence steps
  -> separately advect True=valid quality support
  -> write lead/channel NumPy planes
  -> return ForecastBundle-shaped metadata
```

Use `OpticalFlowNowcaster.predict(event, [30, 60])`. The method is explicitly
labelled `optical_flow`. It preserves each channel's variable and unit labels;
there is no dBZ-to-mm/h conversion. Invalid, non-finite and out-of-domain
pixels are stored as `NaN`, while a valid numeric zero remains zero.

`OpticalFlowPersistenceRouter` catches only optical-flow runtime failures and
then calls the existing persistence adapter. A fallback result remains labelled
`persistence` and includes the routing reason in its warnings. Invalid events
and unsupported lead times are not hidden by fallback.

The provider does not accept an evaluation-target argument. Future truth is
loaded separately by evaluation code. `compare_methods_by_lead` compares named
method arrays against that truth using an explicit True=eligible mask plus the
finite prediction/target intersection, and records event, method, lead,
threshold, valid count, CSI, MAE and RMSE.

## Scientific limits

- This is deterministic optical-flow advection, not learned AI inference.
- It transports existing features and cannot reliably create, intensify,
  split, merge or decay convection.
- The repository's deterministic fixture is synthetic plumbing evidence, not
  meteorological validation or evidence of forecast skill.
- No Indian validation, calibrated uncertainty or hazard probabilities exist.
- Hail, lightning, downburst and cloudburst remain unavailable with null
  probability.
- Unknown CRS and bounds stay unknown.
- The current ForecastBundle v1 documentation does not yet enumerate
  `optical_flow`; backend/frontend exposure needs a coordinated contract change
  and is intentionally deferred to Devananda's capability-routing work.
- Real persistence-versus-optical-flow skill numbers wait for Harinandana's
  independently sourced MRMS replay and separately stored +30/+60 truth.
