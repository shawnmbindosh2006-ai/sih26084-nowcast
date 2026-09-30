const METHOD_LABELS = {
  fixture: "Fixture",
  persistence: "Persistence",
  optical_flow: "pySTEPS Lucas–Kanade Optical Flow",
  opticalflow: "pySTEPS Lucas–Kanade Optical Flow",
  earthformer: "EarthFormer",
};

export function methodLabel(method) {
  if (typeof method !== "string" || !method.trim()) return "Unavailable";
  const key = method.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  return METHOD_LABELS[key] || method.trim();
}

export function modeLabel(mode) {
  switch (mode) {
    case "synthetic":
    case "synthetic_demo":
      return "SYNTHETIC DEMO";
    case "replay":
      return "US ARCHIVED REPLAY";
    case "live":
      return "LIVE";
    default:
      return "MODE UNAVAILABLE";
  }
}

function frameLead(frame) {
  const value = Number(frame?.lead_minutes);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function legacyBounds(frame) {
  const bbox = frame?.bounds?.bbox;
  return Array.isArray(bbox) && bbox.length === 4 ? bbox : null;
}

function collectSourceText(value, parentKey = "", result = []) {
  if (typeof value === "string") {
    const text = value.trim();
    if (
      text &&
      !/path|filename|file_path/i.test(parentKey) &&
      !/^(?:[a-z]:[\\/]|\\\\|file:\/\/)/i.test(text) &&
      !result.includes(text)
    ) {
      result.push(text);
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectSourceText(entry, parentKey, result));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => collectSourceText(entry, key, result));
  }
  return result;
}

export function sourceSummary(sources) {
  return collectSourceText(sources).slice(0, 4).join(" · ") || "Not supplied";
}

export function normalizeDashboardData(data) {
  if (Array.isArray(data?.frames)) {
    const hasSupportedLeads = Array.isArray(data.supported_lead_times_minutes);
    const supportedLeads = new Set(
      (data.supported_lead_times_minutes || []).map(Number).filter(Number.isInteger),
    );
    const frames = data.frames
      .filter((frame) => {
        const lead = frameLead(frame);
        return (
          lead !== null &&
          frame?.supported !== false &&
          (!hasSupportedLeads || lead === 0 || supportedLeads.has(lead))
        );
      })
      .sort((a, b) => frameLead(a) - frameLead(b));
    return {
      schema: "forecast-bundle-v1",
      mode: data.mode,
      method: data.forecast_method,
      eventTimeUtc: data.event_time_utc,
      issueTimeUtc: data.issued_at_utc,
      runId: data.run_id,
      eventId: data.event_id,
      grid: data.grid || {},
      sources: data.sources,
      sourceText: sourceSummary(data.sources),
      hazards: data.hazards || {},
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      metrics: null,
      replayClockUtc: null,
      frames,
    };
  }

  if (Array.isArray(data?.leads)) {
    const frames = data.leads
      .filter((frame) => frame?.supported !== false && frameLead(frame) !== null)
      .map((frame) => ({
        ...frame,
        image_url: frame.image_url || null,
        bounds_wgs84: legacyBounds(frame),
      }))
      .sort((a, b) => frameLead(a) - frameLead(b));
    return {
      schema: "legacy-fixture",
      mode: data.mode === "replay" ? "replay" : "synthetic",
      method: data.forecast_method || "fixture",
      eventTimeUtc: data.event_time_utc,
      issueTimeUtc: data.issue_time_utc,
      runId: data.run_id,
      eventId: data.event_id,
      grid: data.grid || {},
      sources: data.provenance,
      sourceText: sourceSummary(data.provenance),
      hazards: {},
      warnings: [],
      metrics: null,
      replayClockUtc: data.replay?.clock_utc || null,
      frames,
    };
  }

  throw new TypeError("Expected a ForecastBundle v1 response or the local fixture format.");
}

export function formatLead(leadMinutes) {
  if (leadMinutes === 0) return "Observed";
  return "+" + leadMinutes + " min";
}

export function validWgs84Bounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) {
    return false;
  }
  const [west, south, east, north] = bounds;
  return west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north;
}

export function resolveArtifactUrl(imageUrl, apiBase, pageOrigin = globalThis.location?.origin) {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) return null;
  const value = imageUrl.trim();
  if (/^(?:[a-z]:[\\/]|\\\\|file:\/\/)/i.test(value)) return null;
  try {
    const base = apiBase || pageOrigin;
    if (!base) return /^https?:\/\//i.test(value) ? value : null;
    const normalizedBase = base.endsWith("/") ? base : base + "/";
    const url = new URL(value, normalizedBase);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function forecastRunUrl(apiBase, runId) {
  if (typeof apiBase !== "string" || !apiBase.trim() || typeof runId !== "string" || !runId.trim()) {
    return null;
  }
  const base = apiBase.endsWith("/") ? apiBase : apiBase + "/";
  try {
    return new URL("api/v1/nowcasts/" + encodeURIComponent(runId), base).href;
  } catch {
    return null;
  }
}

export function hazardPresentation(hazard) {
  const status = typeof hazard?.status === "string" ? hazard.status.toLowerCase() : "unavailable";
  const probability = hazard?.probability;
  if (
    status === "validated" &&
    typeof probability === "number" &&
    Number.isFinite(probability) &&
    probability >= 0 &&
    probability <= 1
  ) {
    return {
      status: "VALIDATED",
      value: Math.round(probability * 100) + "%",
      reason: hazard.reason || "Validated output supplied by the backend.",
    };
  }
  if (status === "proxy") {
    return {
      status: "PROXY",
      value: "Proxy only",
      reason: hazard?.reason || hazard?.method || "This is not a calibrated hazard probability.",
    };
  }
  return {
    status: "UNAVAILABLE",
    value: "Not available",
    reason: hazard?.reason || "No validated hazard output was supplied.",
  };
}

export function isSyntheticMode(mode) {
  return mode === "synthetic" || mode === "synthetic_demo";
}

export function looksLikeMrmsReplay(data) {
  if (!data || data.mode !== "replay") return false;
  const hay = [data.sourceText, data.eventId, JSON.stringify(data.sources || "")]
    .join(" ")
    .toLowerCase();
  return hay.includes("mrms") || hay.includes("noaa");
}

export function sourceDisplay(data) {
  if (isSyntheticMode(data?.mode)) return "Local dashboard fixture";
  if (looksLikeMrmsReplay(data)) return "NOAA MRMS";
  if (data?.sourceText && data.sourceText !== "Not supplied") return data.sourceText;
  return "Not supplied";
}

export function geographyDisplay(data) {
  const bounds = data?.grid?.bounds_wgs84;
  if (validWgs84Bounds(bounds)) {
    const [west, south, east, north] = bounds;
    return `${west.toFixed(4)}, ${south.toFixed(4)} — ${east.toFixed(4)}, ${north.toFixed(4)}`;
  }
  return isSyntheticMode(data?.mode) ? "Not supplied" : "GEOGRAPHY NOT PROVIDED FOR CURRENT EVENT";
}

export function variableDisplay(frame) {
  const value = typeof frame?.variable === "string" ? frame.variable.trim() : "";
  if (value && value !== "illustrative_placeholder" && value.toLowerCase() !== "none") return value;
  return "Reflectivity";
}

export function unitsDisplay(frame) {
  const value = typeof frame?.units === "string" ? frame.units.trim() : "";
  if (value && value.toLowerCase() !== "none" && value !== "illustrative_placeholder") return value;
  return "dBZ";
}

export function leadAvailabilityText(leadMinutes) {
  const leads = (leadMinutes || []).filter((item) => Number.isInteger(item) && item >= 0);
  if (!leads.length) return "Not advertised";
  return leads.map(formatLead).join(" · ");
}

function collectQualityText(value, parentKey = "", result = []) {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && /quality|coverage|mask/i.test(parentKey) && !result.includes(text)) result.push(text);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectQualityText(entry, parentKey, result));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => collectQualityText(entry, key, result));
  }
  return result;
}

export function qualityCoverageText(data) {
  const hits = collectQualityText(data?.sources).concat(collectQualityText(data?.grid));
  return hits[0] || "Not supplied for this run";
}

export function combineHazardZones(hazards) {
  const features = Object.values(hazards || {}).flatMap((hazard) =>
    Array.isArray(hazard?.zones?.features) ? hazard.zones.features : [],
  );
  return features.length ? { type: "FeatureCollection", features } : null;
}
