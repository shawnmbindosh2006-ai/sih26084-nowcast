# Model integration contract

## Persistence adapter

`nowcast.models.predict(event, lead_times)` implements the shared two-argument
interface. `PersistenceNowcaster` accepts an explicit artifact root for API and
test integration.

The adapter reads only `observed_array_path`. The array must be numeric and use
the shared `[T,H,W,C]` layout. Timestamp count must equal `T`, timestamps must be
strictly increasing, `event_time_utc` must equal the last timestamp, and channel
name/unit counts must equal `C`. A supplied quality mask must match `[T,H,W]`,
`[T,H,W,1]`, or `[T,H,W,C]`.

The quality mask must be boolean: `True` means valid. The last observed mask
is broadcast across channels when needed. Invalid pixels are written as `NaN`
in each forecast `.npy` frame; a genuine valid zero stays zero. Masked output
therefore uses a floating dtype even when the input array is integral.
Consumers must treat nonfinite pixels as missing when rendering or computing
metrics. The current evaluation helper rejects nonfinite arrays; callers must
exclude missing pixels explicitly before scoring them.

Evaluation targets are deliberately outside the prediction interface. Unknown
fields such as `evaluation_target_array_path` are not opened or inspected.

The baseline accepts unique increasing five-minute leads from +5 through +60.
+90 minutes and longer horizons are rejected. This is a bounded demo interface,
not evidence that persistence has useful skill throughout that period.

## Forecast artifacts

For each requested lead and channel, the final observed `[H,W]` plane is saved
as a NumPy artifact under `<artifact_root>/<run_id>/`. ForecastBundle frames use
only API paths of this form:

```text
/api/v1/artifacts/<run_id>/<filename>
```

No local filesystem path is placed in `image_url`. The API owner must register
the run directory and serve the files through the contract endpoint. The model
adapter preserves source and grid metadata without inventing geography or
resolution.

All five hazard entries are returned with `status="unavailable"`,
`probability=null`, an empty GeoJSON FeatureCollection, and an explicit reason.
Hazard assessment remains a separate module.

## Fixture handshake needed

The tracked `fixtures/demo-event.json` is metadata-only and correctly fails
prediction because `observed_array_path` is null. The deterministic generator in
`scripts/generate-model-fixture.py` is only for model plumbing and unit tests.
It writes ignored files under `runs/` and is not weather data or skill evidence.

Data integration needs one versioned fixture manifest plus an external or
generated array with matching timestamps, channel order, units, mask, grid, and
provenance. Any normalization must occur at a documented boundary; persistence
copies the supplied representation unchanged.

## Evaluation boundary

`nowcast.evaluation` reports MAE, RMSE, CSI, POD, and FAR separately by lead.
Hits, misses, and false alarms are recorded, and zero denominators return null.
Thresholds and units must be supplied by the caller. Synthetic arrays validate
metric plumbing only. Until archived observed future frames are available, the
project result is: **Pipeline checks completed; weather-skill evaluation
unavailable.**
