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

The repository contains an initial project scaffold and technical interfaces. Application implementation and validation are in progress. The first demonstration is intended to use small synthetic fixtures or archived event replay before integrating additional data sources.

## Scientific scope

Forecast horizon, data coverage and effective spatial resolution will be reported for each configuration. Synthetic demonstrations, archived replay, baseline forecasts and learned-model inference must be clearly distinguished.

SEVIR-based development does not establish performance over India. Radar VIL is not rainfall in mm/h. Hail, lightning, downburst and cloudburst outputs require suitable observations, methods and validation; unavailable outputs must remain explicit.

## Local setup

Installation and run instructions will be added with the runnable prototype, including application dependencies, sample data requirements and optional model setup.
