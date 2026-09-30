# Convective Nowcasting

A research prototype for **SIH26084 — Convective scale nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 hr)**.

## Project objective

Develop a short-range storm forecasting workflow that combines meteorological observations, nowcasting models and geospatial visualisation. The problem statement targets 0–6 hour forecasts at 1–3 km spatial resolution for local severe-weather assessment.

## Planned system

- Ingest and quality-check radar, satellite and lightning observations where data access is available.
- Align observations in space and time while retaining their units and source metadata.
- Generate forecasts through a reproducible baseline or a verified pretrained model.
- Display observed and forecast frames, supported lead times and hazard information in a GIS dashboard.
- Evaluate forecast performance on independent events.

## Current status

The integrated prototype provides a reproducible synthetic EventBundle, CPU persistence at +30/+60, an optional pySTEPS 1.21.5 Lucas--Kanade/semilagrangian baseline, FastAPI ForecastBundle v1 routes, confined NumPy/PNG artifacts, and a capability-driven React dashboard. A bounded US NOAA MRMS archived replay can be built separately; it is not Indian validation and its committed selection has only short-horizon (+2/+4 minute) future truth.

## Scientific scope

Forecast horizon, data coverage and effective spatial resolution will be reported for each configuration. Synthetic demonstrations, archived replay, baseline forecasts and learned-model inference must be clearly distinguished.

SEVIR-based development does not establish performance over India. Radar VIL is not rainfall in mm/h. Hail, lightning, downburst and cloudburst outputs require suitable observations, methods and validation; unavailable outputs must remain explicit.

## Local setup

Python 3.11 and Node.js 20.19+ (or 22.12+) are required. The stable Windows persistence demo installs its own environment and starts both services:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
```

Open `http://127.0.0.1:5173` and stop both processes with Ctrl+C. For manual setup, API examples, the optional conda-based pySTEPS runtime, and the bounded MRMS replay, see [local run instructions](docs/LOCAL_RUN.md), [optical-flow notes](docs/OPTICAL_FLOW.md), and [data access notes](docs/DATA_ACCESS.md).

The dashboard only displays methods and leads advertised by the live API. Persistence and optical flow are deterministic baselines, not learned AI forecasts; hazards remain unavailable/null unless independently validated.
