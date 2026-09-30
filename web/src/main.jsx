import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { GeoJSON, ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import fixture from "./fixture.json";
import { chooseDefaultMethod, discoverForecastOptions, requestNowcast, supportedFrames } from "./contract.js";
import {
  combineHazardZones,
  formatLead,
  hazardPresentation,
  methodLabel,
  modeLabel,
  normalizeDashboardData,
  resolveArtifactUrl,
  validWgs84Bounds,
} from "./dashboardModel.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const HAZARD_NAMES = ["storm_intensity_proxy", "hail", "lightning", "downburst", "cloudburst"];

function fmtUtc(value) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().replace("T", " ").replace(".000Z", "Z") : "Unavailable";
}

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function App({ initialBundle = fixture, apiBase = API_BASE }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [discovery, setDiscovery] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedLead, setSelectedLead] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [apiState, setApiState] = useState(apiBase ? "discovering" : "fixture");
  const [error, setError] = useState("");
  const [artifactFailed, setArtifactFailed] = useState(false);

  useEffect(() => {
    if (!apiBase) return undefined;
    const controller = new AbortController();
    discoverForecastOptions(apiBase, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const method = chooseDefaultMethod(result);
        const pipeline = result.availablePipelines[method];
        setDiscovery(result);
        setSelectedMethod(method);
        setSelectedEvent(pipeline.event_id);
        setSelectedLead(pipeline.supported_lead_times_minutes[0]);
        setApiState("ready");
        setError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setApiState("fixture");
          setError(`API discovery failed (${reason.message}). Showing the local synthetic fixture.`);
        }
      });
    return () => controller.abort();
  }, [apiBase]);

  const methods = discovery ? Object.keys(discovery.availablePipelines) : [];
  const pipeline = discovery?.availablePipelines[selectedMethod] || null;
  const events = discovery?.events || [];

  function selectMethod(method) {
    const next = discovery.availablePipelines[method];
    setSelectedMethod(method);
    setSelectedEvent(next.event_id);
    setSelectedLead(next.supported_lead_times_minutes[0]);
    setError("");
  }

  async function generateForecast(event) {
    event.preventDefault();
    if (!pipeline) return;
    setApiState("loading");
    setError("");
    try {
      const response = await requestNowcast(apiBase, {
        eventId: selectedEvent,
        leadTimesMinutes: [selectedLead],
        forecastMethod: selectedMethod,
      });
      setBundle(response);
      setFrameIndex(0);
      setArtifactFailed(false);
      setApiState("online");
    } catch (reason) {
      setApiState("error");
      setError(`Forecast request failed (${reason.message}). No substitute forecast was generated.`);
    }
  }

  const view = useMemo(() => normalizeDashboardData(bundle), [bundle]);
  const frames = useMemo(() => supportedFrames(bundle), [bundle]);
  const selectedFrame = frames[frameIndex] || frames[0] || null;
  const bounds = view.grid?.bounds_wgs84;
  const hasBounds = validWgs84Bounds(bounds);
  const mapBounds = hasBounds ? [[bounds[1], bounds[0]], [bounds[3], bounds[2]]] : null;
  const center = hasBounds ? [(bounds[1] + bounds[3]) / 2, (bounds[0] + bounds[2]) / 2] : null;
  const imageUrl = resolveArtifactUrl(selectedFrame?.image_url, apiBase);
  const numericUrl = resolveArtifactUrl(selectedFrame?.numeric_array_url || selectedFrame?.numeric_url, apiBase);
  const zones = combineHazardZones(view.hazards);

  return (
    <div className="app">
      <header className="topbar">
        <div><div className="eyebrow">SIH26084 · honest prototype</div><h1>VajraVIEW Nowcasting</h1></div>
        <div className="mode-badge"><span className="dot" />{modeLabel(view.mode)}</div>
      </header>

      <main>
        <section className="card method-panel" aria-label="Forecast controls">
          <div className="card-head">
            <div><h2>Forecast request</h2><p>Only backend-advertised methods and lead times are selectable.</p></div>
            <span className="pill">{apiState === "online" ? "API result" : apiState === "fixture" ? "Local fixture" : apiState}</span>
          </div>
          {error && <div className="banner warning" role="alert">{error}</div>}
          {discovery ? (
            <form className="request-grid" onSubmit={generateForecast}>
              <label>Method
                <select aria-label="Forecast method" value={selectedMethod} onChange={(event) => selectMethod(event.target.value)}>
                  {methods.map((method) => <option value={method} key={method}>{methodLabel(method)}</option>)}
                </select>
              </label>
              <label>Event
                <select aria-label="Forecast event" value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)}>
                  {!events.some((item) => item.event_id === pipeline?.event_id) && pipeline && <option value={pipeline.event_id}>{pipeline.event_id}</option>}
                  {events.map((item) => <option value={item.event_id} key={item.event_id}>{item.event_id}</option>)}
                </select>
              </label>
              <label>Lead time
                <select aria-label="Forecast lead time" value={selectedLead} onChange={(event) => setSelectedLead(Number(event.target.value))}>
                  {pipeline.supported_lead_times_minutes.map((lead) => <option value={lead} key={lead}>{formatLead(lead)}</option>)}
                </select>
              </label>
              <button className="play" type="submit" disabled={apiState === "loading"}>{apiState === "loading" ? "Generating…" : "Generate forecast"}</button>
            </form>
          ) : (
            <div className="banner info" role="status">{apiState === "discovering" ? "Discovering backend capabilities…" : "API unavailable. Synthetic fixture metadata only."}</div>
          )}
        </section>

        <section className="status-row">
          <StatusCard title="Mode" value={modeLabel(view.mode)} />
          <StatusCard title="Actual method" value={methodLabel(view.method)} />
          <StatusCard title="Event" value={view.eventId} />
          <StatusCard title="Issued UTC" value={fmtUtc(view.issueTimeUtc)} />
          <StatusCard title="Valid UTC" value={fmtUtc(selectedFrame?.valid_time_utc)} />
        </section>

        {view.warnings.map((warning, index) => <div className="banner warning" key={index}>{typeof warning === "string" ? warning : JSON.stringify(warning)}</div>)}

        <section className="grid">
          <div className="card map-card">
            <div className="card-head">
              <div><h2>Forecast frame</h2><p>{selectedFrame ? `${selectedFrame.variable || "Variable unavailable"} · ${selectedFrame.units || "units unavailable"}` : "No frame returned"}</p></div>
              <span className="pill">{selectedFrame ? formatLead(selectedFrame.lead_minutes) : "Unavailable"}</span>
            </div>
            {hasBounds ? (
              <MapContainer center={center} zoom={6} scrollWheelZoom className="map">
                <MapResize />
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {imageUrl && !artifactFailed && <ImageOverlay url={imageUrl} bounds={mapBounds} opacity={0.82} eventHandlers={{ error: () => setArtifactFailed(true) }} />}
                {zones && <GeoJSON data={zones} />}
              </MapContainer>
            ) : (
              <div className="neutral-map">
                {imageUrl && !artifactFailed ? <img className="forecast-image" src={imageUrl} alt="Backend forecast frame" onError={() => setArtifactFailed(true)} /> : (
                  <div><strong>{artifactFailed ? "Forecast artifact unavailable" : "Geography unknown"}</strong><p>{artifactFailed ? "The API image could not be loaded; no substitute is shown." : "No valid WGS84 bounds were supplied. Map placement is not invented."}</p></div>
                )}
              </div>
            )}
            <div className="frame-meta">
              <span><b>Artifact:</b> {imageUrl ? "API-served PNG" : "Unavailable"}</span>
              {numericUrl && <a href={numericUrl} target="_blank" rel="noreferrer">Download numeric array</a>}
            </div>
            <div className="lead-buttons">
              {frames.map((frame, index) => <button className={index === frameIndex ? "active" : ""} onClick={() => { setFrameIndex(index); setArtifactFailed(false); }} key={frame.lead_minutes}>{formatLead(frame.lead_minutes)}</button>)}
            </div>
          </div>

          <aside className="card hazard-card">
            <div className="card-head"><div><h2>Hazard evidence</h2><p>Null never means safe. Probabilities appear only when validated.</p></div></div>
            {HAZARD_NAMES.map((name) => <Hazard key={name} name={name} data={view.hazards[name]} />)}
          </aside>
        </section>

        <section className="bottom-grid">
          <div className="card"><h2>Provenance</h2><p>{view.sourceText}</p><p>Run: {view.runId || "Not supplied"}</p></div>
          <div className="card"><h2>Scientific boundary</h2><p>Persistence and optical flow are deterministic baselines, not learned AI. Synthetic/replay results do not establish Indian forecast skill.</p></div>
        </section>
      </main>
      <footer>VajraVIEW · capability-driven ForecastBundle v1 dashboard · no unsupported hazard claims</footer>
    </div>
  );
}

function StatusCard({ title, value }) {
  return <div className="status-card"><b>{title}</b><span>{value || "Not supplied"}</span></div>;
}

function Hazard({ name, data }) {
  const presentation = hazardPresentation(data);
  return <div className="hazard"><div><b>{name.replaceAll("_", " ")}</b><span>{presentation.status}</span><small>{presentation.reason}</small></div><strong>{presentation.value}</strong></div>;
}

if (typeof document !== "undefined" && document.getElementById("root")) {
  createRoot(document.getElementById("root")).render(<App />);
}
