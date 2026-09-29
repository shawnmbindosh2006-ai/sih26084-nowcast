# SIH26084 Nowcast Dashboard

React + Vite + Leaflet dashboard for Anamika's `feature/anamika-dashboard` workstream.

## Run
```bash
npm ci
npm run dev
```

Optional API integration:
```bash
copy .env.example .env
# set VITE_API_BASE_URL to Devananda's documented API base
```

Production check:
```bash
npm run build
```

If the API is absent/unreachable, the UI remains usable with `src/fixture.json` and visibly identifies itself as a synthetic replay.
