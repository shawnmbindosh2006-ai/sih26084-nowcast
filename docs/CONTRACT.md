# Shared contract version 1

Freeze this contract before module integration. Devananda implements and validates it; Manish coordinates changes. Do not silently rename fields.

## EventBundle
JSON metadata plus array files. schema_version="1.0"; event_id; mode=synthetic|replay|live; source records with provenance and availability; event_time_utc is the last observed timestamp; timestamps_utc is strictly increasing; observed_array_path points to an array [T,H,W,C]; channel_names and channel_units correspond to C; quality_mask_path may be null. Evaluation targets use a different file and are excluded from inference.
grid includes native_spacing_km, effective_spacing_km, crs and bounds_wgs84 [west,south,east,north]. Fields may be null when unknown. Null bounds require an image view. Resampling records its method and source resolution; finer pixel spacing is not finer validated forecast skill.

## ForecastBundle
schema_version="1.0"; run_id; event_id; mode=synthetic|replay|live; forecast_method=fixture|persistence|earthformer; issued_at_utc; event_time_utc; supported_lead_times_minutes; sources; model={id,version,checkpoint_sha256}; grid; frames=[{lead_minutes,valid_time_utc,image_url,variable,units}]; hazards; warnings. URLs are served by the API, not laptop filesystem paths. For real model output the method uses the actual model ID, with the enum updated through a contract PR if needed.
hazards has storm_intensity_proxy, hail, lightning, downburst and cloudburst. Each has status=proxy|validated|unavailable; probability=null unless genuinely calibrated; units, method, reason and zones=GeoJSON FeatureCollection. estimated_arrival_utc and timing_uncertainty_minutes may be null. A probability is 0..1, not a qualitative confidence label. Lightning density and downburst velocity need their own physical values/units and supporting method, not a substitute probability.

## API
GET /health; GET /api/v1/capabilities; GET /api/v1/events; POST /api/v1/nowcasts with {event_id,lead_times_minutes}; GET /api/v1/nowcasts/{run_id}; GET /api/v1/artifacts/{run_id}/{filename}. For the first demo the POST may return a completed run synchronously; document if a later job queue changes that behaviour.

## Python interface
load_event(path)->EventBundle; predict(event,lead_times)->ForecastBundle; assess_hazards(forecast,event)->hazards. Model inference sees observed data only. Array orientation, native encoding and normalization must be documented and checked against the checkpoint before learned inference.

## Supported scope
Fixture and persistence pipelines are integration baselines. Earthformer is a candidate pending successful local inference; its official SEVIR benchmark setup is VIL-only and up to 60 minutes. No early claim of full multi-sensor fusion, 0-6 hour convective skill or Indian hazard validation. Missing feeds are unavailable; unsupported horizons are rejected, not fabricated. All clocks follow UTC, with archived countdowns tied to replay time.
