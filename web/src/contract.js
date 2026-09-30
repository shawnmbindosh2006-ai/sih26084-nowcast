export const HAZARD_NAMES = ['storm_intensity_proxy', 'hail', 'lightning', 'downburst', 'cloudburst'];

export function supportedFrames(bundle) {
  if (bundle?.schema_version !== '1.0' || !Array.isArray(bundle.frames) || !Array.isArray(bundle.supported_lead_times_minutes)) {
    throw new Error('Expected a ForecastBundle v1 response.');
  }
  const supported = new Set(bundle.supported_lead_times_minutes);
  return bundle.frames
    .filter(frame => Number.isInteger(frame.lead_minutes) && supported.has(frame.lead_minutes))
    .sort((a, b) => a.lead_minutes - b.lead_minutes);
}

export function mapBounds(grid) {
  const bounds = grid?.bounds_wgs84;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) return null;
  const [west, south, east, north] = bounds;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return [[south, west], [north, east]];
}

export function probabilityLabel(hazard) {
  const probability = hazard?.probability;
  return hazard?.status === 'validated' && typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 1
    ? `${Math.round(probability * 100)}%`
    : 'Not available';
}

export function frameLabel(bundle, frame) {
  if (frame.lead_minutes === 0) return bundle.mode === 'synthetic' ? 'Synthetic reference scene (t0)' : 'Reference frame (t0)';
  return `+${frame.lead_minutes} min`;
}

export function artifactUrl(imageUrl, apiBase) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (!apiBase) return imageUrl;
  return new URL(imageUrl, `${apiBase.replace(/\/$/, '')}/`).toString();
}

function apiUrl(apiBase, path) {
  if (typeof apiBase !== 'string' || !apiBase.trim()) throw new Error('API base URL is not configured.');
  return `${apiBase.replace(/\/$/, '')}${path}`;
}

async function apiJson(apiBase, path, options, fetcher) {
  const response = await fetcher(apiUrl(apiBase, path), options);
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.detail || ''; } catch { /* response may not be JSON */ }
    throw new Error(`${path}: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
  }
  return response.json();
}

function validPipeline(method, value) {
  const leads = value?.supported_lead_times_minutes?.filter(item => Number.isInteger(item) && item >= 0);
  if (typeof value?.event_id !== 'string' || !value.event_id || !leads?.length) return null;
  return {method, event_id: value.event_id, supported_lead_times_minutes: [...new Set(leads)].sort((a, b) => a - b)};
}

export async function discoverForecastOptions(apiBase, signal, fetcher = fetch) {
  const [capabilities, eventResponse] = await Promise.all([
    apiJson(apiBase, '/api/v1/capabilities', {signal}, fetcher),
    apiJson(apiBase, '/api/v1/events', {signal}, fetcher),
  ]);
  const advertised = Array.isArray(capabilities.forecast_methods) ? capabilities.forecast_methods : [];
  const availablePipelines = {};
  for (const method of advertised) {
    const pipeline = validPipeline(method, capabilities.available_pipelines?.[method]);
    if (pipeline) availablePipelines[method] = pipeline;
  }
  if (!Object.keys(availablePipelines).length) throw new Error('The backend advertised no callable forecast pipeline.');
  return {
    capabilities,
    events: Array.isArray(eventResponse.events) ? eventResponse.events : [],
    availablePipelines,
  };
}

export function chooseDefaultMethod(discovery) {
  const methods = Object.keys(discovery?.availablePipelines || {});
  if (methods.includes('persistence')) return 'persistence';
  if (methods.includes('fixture')) return 'fixture';
  if (!methods.length) throw new Error('No forecast method is available.');
  return methods[0];
}

export async function requestNowcast(
  apiBase,
  {eventId, leadTimesMinutes, forecastMethod},
  signal,
  fetcher = fetch,
) {
  const data = await apiJson(apiBase, '/api/v1/nowcasts', {
    method: 'POST',
    signal,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      event_id: eventId,
      lead_times_minutes: leadTimesMinutes,
      forecast_method: forecastMethod,
    }),
  }, fetcher);
  if (!supportedFrames(data).length) throw new Error('The API returned no supported ForecastBundle v1 frames.');
  return data;
}

export async function fetchForecastBundle(apiBase, signal, fetcher = fetch) {
  const discovery = await discoverForecastOptions(apiBase, signal, fetcher);
  const method = chooseDefaultMethod(discovery);
  const pipeline = discovery.availablePipelines[method];
  return requestNowcast(apiBase, {
    eventId: pipeline.event_id,
    leadTimesMinutes: pipeline.supported_lead_times_minutes,
    forecastMethod: method,
  }, signal, fetcher);
}
