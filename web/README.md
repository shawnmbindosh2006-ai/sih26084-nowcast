# SIH26084 Nowcast Dashboard

React + Vite + Leaflet dashboard for Anamika's dashboard workstream.

Requires Node.js 20.19+ or 22.12+ (the Vite 8 engine requirement).

## Run locally

    npm ci
    npm run dev

The dashboard reads `GET /api/v1/capabilities` and `GET /api/v1/events`, builds its method and lead selectors only from `available_pipelines`, and sends the selected `forecast_method` explicitly to `POST /api/v1/nowcasts`. It renders the returned ForecastBundle v1 `frames` and API artifact URLs. Optical flow is hidden when the backend does not advertise a callable runtime.

Copy `.env.example` to `.env` when the API is not at `http://localhost:8000`. No saved run ID is required: the dashboard discovers events and creates the selected forecast through the documented API.

Production check:
```bash
npm run build
npm run check
npm test
```

If the API is absent or unreachable, the UI remains usable with `src/fixture.json` and visibly identifies itself as a synthetic local demo. It never substitutes invented geography, hazards, or images. The fixtures and UI tests establish contract plumbing only, not forecast skill.
