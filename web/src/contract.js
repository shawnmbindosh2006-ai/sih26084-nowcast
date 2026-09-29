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

export async function fetchForecastBundle(apiBase, signal, fetcher=fetch) {
  async function apiJson(path, options) {
    const response=await fetcher(`${apiBase.replace(/\/$/, '')}${path}`, options);
    if(!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }
  const [capabilities, events]=await Promise.all([
    apiJson('/api/v1/capabilities',{signal}),
    apiJson('/api/v1/events',{signal}),
  ]);
  const eventId=events.events?.[0]?.event_id;
  const leadTimes=capabilities.supported_lead_times_minutes?.filter(value=>Number.isInteger(value) && value>=0);
  if(!eventId || !leadTimes?.length) throw new Error('No event or supported lead times are available.');
  const data=await apiJson('/api/v1/nowcasts',{
    method:'POST',signal,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({event_id:eventId,lead_times_minutes:leadTimes}),
  });
  if(!supportedFrames(data).length) throw new Error('The API returned no supported ForecastBundle v1 frames.');
  return data;
}
