import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ImageOverlay,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import fixture from "./fixture.json";
import {
  combineHazardZones,
  forecastRunUrl,
  formatLead,
  hazardPresentation,
  methodLabel,
  modeLabel,
  normalizeDashboardData,
  resolveArtifactUrl,
  validWgs84Bounds,
} from "./dashboardModel.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_RUN_ID = import.meta.env.VITE_API_RUN_ID || "";

function utcNow() {
  return Date.now();
}

function fmtUtc(iso) {
  if (!iso) return "Unavailable";
  const time = new Date(iso);
  return Number.isNaN(time.getTime())
    ? "Unavailable"
    : time.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function fmtIst(iso) {
  if (!iso) return "Unavailable";
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time) + " IST";
}

function countdown(arrival, clock) {
  if (!arrival || !Number.isFinite(clock)) return null;
  const delta = new Date(arrival).getTime() - clock;
  if (!Number.isFinite(delta) || delta < 0) return null;
  const total = Math.floor(delta / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function App() {
  const [bundle, setBundle] = useState(fixture);
  const [dataOrigin, setDataOrigin] = useState("fixture");
  const [apiState, setApiState] = useState(
    API_BASE ? (API_RUN_ID ? "loading" : "configuration") : "fixture",
  );
  const [error, setError] = useState("");
  const [leadIndex, setLeadIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayClock, setReplayClock] = useState(
    new Date(fixture.replay?.clock_utc || fixture.issue_time_utc).getTime(),
  );
  const [artifactFailed, setArtifactFailed] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!API_BASE || !API_RUN_ID) return undefined;
    const url = forecastRunUrl(API_BASE, API_RUN_ID);
    if (!url) {
      setApiState("error");
      setError("The API base URL or run ID is invalid. Showing the synthetic fixture.");
      return undefined;
    }

    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then((data) => {
        const normalized = normalizeDashboardData(data);
        if (normalized.schema !== "forecast-bundle-v1") {
          throw new Error("The API response is not a ForecastBundle v1.");
        }
        setBundle(data);
        setDataOrigin("api");
        setApiState("online");
        setError("");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setApiState("error");
        setError("Could not load the requested forecast run (" + requestError.message + "). Showing the clearly labelled synthetic fixture.");
        setBundle(fixture);
        setDataOrigin("fixture");
      });
    return () => controller.abort();
  }, []);

  const view = useMemo(() => normalizeDashboardData(bundle), [bundle]);
  const frames = view.frames;
  const selected = frames[leadIndex] || frames[0] || null;

  useEffect(() => {
    setLeadIndex(0);
    setPlaying(false);
  }, [view.runId, view.eventId, view.schema, frames.length]);

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = setInterval(() => {
      setLeadIndex((current) => {
        if (current + 1 >= frames.length) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, frames.length]);

  const isReplay = view.mode === "replay";
  const clock = view.mode === "live"
    ? utcNow()
    : view.schema === "legacy-fixture"
      ? replayClock
      : isReplay && view.replayClockUtc
        ? new Date(view.replayClockUtc).getTime()
        : Number.NaN;
  const hazards = { ...(view.hazards || {}), ...(selected?.hazards || {}) };
  const arrivalTime = selected?.arrival_estimate_utc || hazards.estimated_arrival_utc;
  const arrival = countdown(arrivalTime, clock);
  const stale = selected?.input?.stale === true;
  const sourceText = view.sourceText;
  const isMrmsReplay = isReplay && /MRMS/i.test(sourceText);
  const rawBounds = validWgs84Bounds(view.grid?.bounds_wgs84)
    ? view.grid.bounds_wgs84
    : selected?.bounds_wgs84;
  const hasBounds = validWgs84Bounds(rawBounds);
  const center = hasBounds
    ? [(rawBounds[1] + rawBounds[3]) / 2, (rawBounds[0] + rawBounds[2]) / 2]
    : null;
  const artifactUrl = resolveArtifactUrl(selected?.image_url, API_BASE);
  const zones = combineHazardZones(hazards);
  const nativeSpacing = view.grid?.native_spacing_km ?? view.grid?.native_km;
  const effectiveSpacing = view.grid?.effective_spacing_km ?? view.grid?.effective_km;

  useEffect(() => {
    setArtifactFailed(false);
  }, [artifactUrl]);

  useEffect(() => {
    setTileError(false);
  }, [hasBounds, rawBounds?.join(",")]);

  const unsupportedHazards = ["hail", "lightning", "downburst", "cloudburst"];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="eyebrow">MoES / NCMRWF · SIH26084</div>
          <h1>Convective Nowcast Dashboard</h1>
        </div>
        <div className="mode-badge">
          <span className="dot" />
          {modeLabel(view.mode)}
        </div>
      </header>
      <main>
        <section className="status-row">
          <StatusCard title="Data mode" value={modeLabel(view.mode)} />
          <StatusCard title="Forecast method" value={methodLabel(view.method)} />
          <StatusCard title="Event time" value={fmtUtc(view.eventTimeUtc)} />
          <StatusCard title="Issue time" value={fmtUtc(view.issueTimeUtc)} />
          <StatusCard title="Source" value={sourceText} />
        </section>

        {error && <div className="banner warning" role="status">{error}</div>}
        {apiState === "configuration" && (
          <div className="banner warning" role="status">
            API base URL is set, but no run ID is configured. Set VITE_API_RUN_ID to display a saved ForecastBundle.
          </div>
        )}
        {apiState === "loading" && (
          <div className="banner info" role="status">
            Loading the configured ForecastBundle run. The synthetic fixture remains visibly labelled until it arrives.
          </div>
        )}
        {apiState === "fixture" && (
          <div className="banner info" role="status">
            Showing the local synthetic fixture. Configure VITE_API_BASE_URL and VITE_API_RUN_ID to load a backend ForecastBundle.
          </div>
        )}
        {stale && (
          <div className="banner danger" role="status">
            Stale input: this frame is retained for replay/demo only. Hazard countdowns are not presented as live.
          </div>
        )}
        {isReplay && view.schema === "forecast-bundle-v1" && !view.replayClockUtc && (
          <div className="banner warning" role="status">
            This archived replay has no replay clock in the documented ForecastBundle fields; arrival countdown is unavailable.
          </div>
        )}
        {view.warnings.map((warning, index) => (
          <div className="banner warning" role="status" key={index}>
            {typeof warning === "string" ? warning : JSON.stringify(warning)}
          </div>
        ))}

        <section className="grid">
          <div className="card map-card">
            <div className="card-head">
              <div>
                <h2>Forecast frame</h2>
                <p>
                  {isMrmsReplay ? "US archived replay · " : ""}
                  {nativeSpacing ? nativeSpacing + " km native" : "Native spacing unknown"}
                  {effectiveSpacing ? " · " + effectiveSpacing + " km effective" : ""}
                </p>
              </div>
              <span className="pill">{selected ? formatLead(Number(selected.lead_minutes)) : "No supported frame"}</span>
            </div>

            {hasBounds && !tileError ? (
              <MapContainer center={center} zoom={6} scrollWheelZoom className="map">
                <MapResize />
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  eventHandlers={{ tileerror: () => setTileError(true) }}
                />
                {artifactUrl && !artifactFailed && (
                  <ImageOverlay
                    url={artifactUrl}
                    bounds={[[rawBounds[1], rawBounds[0]], [rawBounds[3], rawBounds[2]]]}
                    opacity={0.82}
                    eventHandlers={{ error: () => setArtifactFailed(true) }}
                  />
                )}
                {zones && <GeoJSON data={zones} />}
              </MapContainer>
            ) : (
              <div className="neutral-map">
                {artifactUrl && !artifactFailed ? (
                  <img
                    className="forecast-image"
                    src={artifactUrl}
                    alt="Backend forecast frame"
                    onError={() => setArtifactFailed(true)}
                  />
                ) : (
                  <div>
                    <strong>
                      {artifactFailed
                        ? "Forecast artifact unavailable"
                        : tileError
                          ? "Basemap unavailable"
                          : "Geography unknown"}
                    </strong>
                    <p>
                      {artifactFailed
                        ? "The API image could not be loaded. No substitute image is shown."
                        : tileError
                          ? "Valid coordinates are known, but map tiles could not be loaded. No alternate map is invented."
                          : "No valid WGS84 bounds were supplied. The dashboard will not invent map placement."}
                    </p>
                    {!artifactUrl && !artifactFailed && <p>No forecast image artifact was supplied for this frame.</p>}
                  </div>
                )}
              </div>
            )}
            {artifactFailed && (
              <div className="banner danger" role="alert">
                The forecast artifact could not be fetched. No substitute image is shown.
              </div>
            )}
            {selected && (
              <div className="frame-meta">
                <span><b>Valid time:</b> {fmtUtc(selected.valid_time_utc)}</span>
                <span><b>Variable:</b> {selected.variable || "Not supplied"}</span>
                <span><b>Units:</b> {selected.units || "Not supplied"}</span>
                {artifactUrl && <span><b>Artifact:</b> API-served frame</span>}
              </div>
            )}
            <div className="map-caption">
              Map placement requires valid WGS84 bounds. Frame images are loaded only from the backend artifact URL.
            </div>
          </div>

          <aside className="card hazard-card">
            <div className="card-head">
              <div>
                <h2>Hazard status</h2>
                <p>Probabilities appear only for validated backend outputs.</p>
              </div>
            </div>
            {unsupportedHazards.map((name) => (
              <Hazard key={name} name={name} data={hazards[name]} />
            ))}
            <div className="proxy">
              <div><b>Storm intensity proxy</b><span>Not rainfall (mm/h)</span></div>
              <strong>{selected?.vil_proxy?.value ?? "—"}</strong>
              <small>{selected?.vil_proxy?.method || "Meaning unavailable"}</small>
            </div>
            <div className="quality">
              <b>Input quality</b>
              <span>{selected?.input?.quality || "Not supplied"}</span>
              <small>{selected?.input?.quality_method || "No calibrated confidence method supplied."}</small>
            </div>
          </aside>
        </section>

        <section className="card controls">
          <div className="control-line">
            <div>
              <h2>Supported forecast frames</h2>
              <p>Only frames returned as supported are selectable.</p>
            </div>
            <div className="lead-buttons">
              {frames.map((frame, index) => (
                <button
                  key={String(frame.lead_minutes)}
                  className={index === leadIndex ? "active" : ""}
                  onClick={() => { setLeadIndex(index); setPlaying(false); }}
                >
                  {formatLead(Number(frame.lead_minutes))}
                </button>
              ))}
              {!frames.length && <span className="muted">No supported forecast frames were returned.</span>}
            </div>
          </div>
          <div className="slider-row">
            <button className="play" disabled={frames.length < 2} onClick={() => setPlaying((value) => !value)}>
              {playing ? "Pause" : "Play"}
            </button>
            <input
              aria-label="Forecast frame"
              type="range"
              min="0"
              max={Math.max(frames.length - 1, 0)}
              value={Math.min(leadIndex, Math.max(frames.length - 1, 0))}
              disabled={frames.length < 2}
              onChange={(event) => { setLeadIndex(Number(event.target.value)); setPlaying(false); }}
            />
            <span>{selected?.valid_time_utc ? fmtUtc(selected.valid_time_utc) : "Unavailable"}</span>
          </div>
          {view.schema === "legacy-fixture" && view.replayClockUtc && (
            <div className="replay-row">
              <label htmlFor="replay-clock">Replay clock</label>
              <input
                id="replay-clock"
                type="range"
                min={new Date(fixture.replay.start_utc).getTime()}
                max={new Date(fixture.replay.end_utc).getTime()}
                value={replayClock}
                onChange={(event) => setReplayClock(Number(event.target.value))}
              />
              <span>{fmtUtc(new Date(replayClock).toISOString())}</span>
            </div>
          )}
        </section>

        <section className="bottom-grid">
          <div className="card">
            <h2>Arrival countdown</h2>
            <div className="countdown">{arrival || "Unavailable"}</div>
            <p>
              {arrivalTime && Number.isFinite(clock)
                ? "Estimate: " + fmtUtc(arrivalTime) + " · " + fmtIst(arrivalTime)
                : "No valid arrival estimate and clock were both supplied."}
            </p>
          </div>
          <div className="card">
            <h2>Data provenance</h2>
            <ul className="meta">
              <li><b>Source/product:</b> {sourceText}</li>
              <li><b>Mode:</b> {modeLabel(view.mode)}</li>
              <li><b>Method:</b> {methodLabel(view.method)}</li>
              <li><b>Region:</b> {isMrmsReplay ? "US replay" : "Unknown unless georeferenced"}</li>
              <li><b>Run:</b> {view.runId || "Not supplied"}</li>
            </ul>
          </div>
        </section>

      </main>
      <footer>
        Dashboard owned by Anamika · {dataOrigin === "fixture" ? "Synthetic fixture preview" : "ForecastBundle v1"} · No unsupported hazard claims are made.
      </footer>
    </div>
  );
}

function StatusCard({ title, value }) {
  return <div className="status-card"><b>{title}</b><span>{value || "Not supplied"}</span></div>;
}

function Hazard({ name, data }) {
  const view = hazardPresentation(data);
  return (
    <div className="hazard">
      <div>
        <b>{name[0].toUpperCase() + name.slice(1)}</b>
        <span>{view.status}</span>
        <small>{view.reason}</small>
      </div>
      <strong>{view.value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
