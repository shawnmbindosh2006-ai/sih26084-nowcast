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

The dashboard reads `GET /api/v1/capabilities` and `GET /api/v1/events`, then requests only advertised leads with `POST /api/v1/nowcasts`. It renders the returned ForecastBundle v1 `frames` and artifact URLs. The current API fixture advertises +15 minutes; the local dashboard fixture is synthetic metadata only and has no weather image or verified geography.

Production check:
```bash
npm run build
npm run check
npm test
```

If the API is absent/unreachable, the UI remains usable with `src/fixture.json` and visibly identifies itself as a synthetic local demo. The API route/render tests use `tests/api-bundle.json`; they do not establish forecast skill or live backend availability.
