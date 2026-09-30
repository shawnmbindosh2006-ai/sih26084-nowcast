# SIH26084 Nowcast Dashboard

React + Vite + Leaflet dashboard for Anamika's dashboard workstream.

## Run locally

    npm ci
    npm run dev

## Display a ForecastBundle v1 run

Copy .env.example to .env, then set VITE_API_BASE_URL to the API origin (for example, http://localhost:8000) and VITE_API_RUN_ID to a run ID returned by the API.

The dashboard reads the documented GET /api/v1/nowcasts/{run_id} endpoint. It displays the response's actual mode, forecast_method, supported_lead_times_minutes, frames, sources, grid, and hazards. Frame images are loaded from each backend-provided image_url. Metrics remain hidden because ForecastBundle v1 does not define an evaluation field.

Method selection and comparison are not wired yet: the current shared contract documents the capabilities endpoint but does not define its response shape or a method field in the nowcast request. The dashboard will not infer available methods from a forecast response.

If the API is missing, the run ID is unset, or the request fails, the page keeps the local fixture visibly labelled as a synthetic demo. It does not substitute an image when a backend artifact fails to load.

## Checks

    npm test
    npm run check
    npm run build
