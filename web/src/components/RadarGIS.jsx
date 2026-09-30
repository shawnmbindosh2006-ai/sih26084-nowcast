import React, { useEffect, useState } from "react";
import { GeoJSON, ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import { mapBounds } from "../contract.js";
import {
  validWgs84Bounds,
  resolveArtifactUrl,
  combineHazardZones,
  formatLead,
  geographyDisplay,
  methodLabel,
  variableDisplay,
  unitsDisplay,
} from "../dashboardModel.js";

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function RadarGIS({ data, frameIndex = 0, setFrameIndex, apiBase }) {
  const [showReflectivity, setShowReflectivity] = useState(true);

  const frame = data.frames?.[frameIndex] || data.frames?.[0];
  const gridBounds = data.grid?.bounds_wgs84 || frame?.bounds_wgs84;
  const isBoundsValid = validWgs84Bounds(gridBounds);
  const leafletBounds = isBoundsValid ? mapBounds({ bounds_wgs84: gridBounds }) : null;
  const imageUrl = resolveArtifactUrl(frame?.image_url, apiBase);
  const hazardZones = combineHazardZones(data.hazards);
  const geographyText = geographyDisplay(data);

  const centerLat = isBoundsValid ? (gridBounds[1] + gridBounds[3]) / 2 : null;
  const centerLng = isBoundsValid ? (gridBounds[0] + gridBounds[2]) / 2 : null;

  return (
    <section className="ws-radar flex flex-col bg-surface-container-lowest border border-outline-variant relative overflow-hidden h-full min-h-[500px]">
      <div className="radar-titlebar">
        <div>
          <span className="radar-titlebar__label">ACTIVE FORECAST CANVAS</span>
          <strong>{variableDisplay(frame)} · {unitsDisplay(frame)}</strong>
        </div>
        <div>
          <span className="radar-titlebar__label">PROVIDER</span>
          <strong>{methodLabel(data.method)}</strong>
        </div>
        <div>
          <span className="radar-titlebar__label">VALID FRAME</span>
          <strong>{formatLead(frame?.lead_minutes ?? 0)}</strong>
        </div>
      </div>
      <div className="relative flex-1 w-full radar-canvas-grid overflow-hidden flex items-center justify-center min-h-[460px]">
        <span className="reticle-corner reticle-corner--tl" aria-hidden="true"></span>
        <span className="reticle-corner reticle-corner--tr" aria-hidden="true"></span>
        <span className="reticle-corner reticle-corner--bl" aria-hidden="true"></span>
        <span className="reticle-corner reticle-corner--br" aria-hidden="true"></span>
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          <div className="w-full h-full radar-beam opacity-30">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-primary/30 to-transparent"></div>
          </div>
        </div>

        <div className="absolute w-[240px] h-[240px] rounded-full border border-primary/20 pointer-events-none flex items-start justify-center pt-1 text-[8px] font-label-sm text-primary/60 z-10">
          RANGE RING
        </div>
        <div className="absolute w-[460px] h-[460px] rounded-full border border-primary/20 pointer-events-none flex items-start justify-center pt-1 text-[8px] font-label-sm text-primary/60 z-10">
          RANGE RING
        </div>
        <div className="absolute w-[680px] h-[680px] rounded-full border border-primary/10 pointer-events-none flex items-start justify-center pt-1 text-[8px] font-label-sm text-primary/40 z-10">
          RANGE RING
        </div>

        <div className="absolute inset-x-0 h-px bg-outline-variant/40 pointer-events-none z-10"></div>
        <div className="absolute inset-y-0 w-px bg-outline-variant/40 pointer-events-none z-10"></div>
        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-label-sm font-label-sm text-outline font-mono z-10">
          000° NORTH
        </span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-label-sm font-label-sm text-outline font-mono z-10">
          180° SOUTH
        </span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-label-sm font-label-sm text-outline font-mono z-10">
          270° WEST
        </span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-label-sm font-label-sm text-outline font-mono z-10">
          090° EAST
        </span>

        {isBoundsValid && leafletBounds && centerLat != null ? (
          <div className="absolute inset-0 z-0">
            <MapContainer
              center={[centerLat, centerLng]}
              zoom={6}
              style={{ width: "100%", height: "100%", background: "#001017" }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {showReflectivity && imageUrl && <ImageOverlay url={imageUrl} bounds={leafletBounds} opacity={0.85} />}
              {hazardZones && <GeoJSON data={hazardZones} style={{ color: "#db504a", weight: 2, fillOpacity: 0.2 }} />}
              <MapResize />
            </MapContainer>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-15 pointer-events-none">
            <div className="font-mono text-sm text-[#87d3d6] font-semibold mb-1 uppercase tracking-wider">
              GEOGRAPHY NOT PROVIDED FOR CURRENT EVENT
            </div>
            <div className="text-[10px] font-mono text-[#bec9c9] max-w-sm bg-[#001017]/80 p-1 border border-[#3f4949]">
              Spatial bounds were not supplied. Canvas remains in image / reticle view.
            </div>
            {imageUrl && showReflectivity && (
              <div className="mt-3 pointer-events-auto max-w-[85%] max-h-[55%]">
                <img
                  src={imageUrl}
                  alt="Nowcast reflectivity frame"
                  className="max-h-[260px] w-auto border border-[#3f4949] bg-[#001017]"
                />
              </div>
            )}
          </div>
        )}

        <div className="absolute top-4 right-4 z-20 bg-surface-container-lowest/95 border border-primary p-2 w-64 shadow-xl backdrop-blur-sm text-label-sm font-label-sm">
          <div className="flex items-center justify-between border-b border-outline-variant pb-1 mb-1">
            <span className="text-primary font-bold flex items-center space-x-1">
              <span className="material-symbols-outlined text-xs text-primary" style={{ marginRight: "4px" }}>my_location</span>
              <span>FRAME INSPECTOR</span>
            </span>
          </div>
          <div className="space-y-0.5 text-on-surface-variant font-mono text-[10px]">
            <div className="flex justify-between gap-2">
              <span>GEOGRAPHY:</span>
              <span className="text-on-surface text-right">{geographyText}</span>
            </div>
            <div className="flex justify-between">
              <span>VARIABLE:</span>
              <span className="text-on-surface">{variableDisplay(frame)}</span>
            </div>
            <div className="flex justify-between">
              <span>UNITS:</span>
              <span className="text-on-surface">{unitsDisplay(frame)}</span>
            </div>
            <div className="flex justify-between">
              <span>METHOD:</span>
              <span className="text-primary">{methodLabel(data.method)}</span>
            </div>
            <div className="flex justify-between">
              <span>LEAD:</span>
              <span className="text-on-surface">{formatLead(frame?.lead_minutes ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>PNG FRAME:</span>
              <span className="text-on-surface">{imageUrl ? "Available" : "Not available"}</span>
            </div>
          </div>
        </div>

        <div className="absolute top-3 left-3 flex flex-col space-y-1.5 z-20">
          <div className="bg-surface-container-low/90 border border-outline-variant p-0.5 flex flex-col space-y-0.5">
            <button type="button" className="p-1 hover:bg-surface-container text-on-surface hover:text-primary transition-colors" title="Zoom In">
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
            <button type="button" className="p-1 hover:bg-surface-container text-on-surface hover:text-primary transition-colors" title="Zoom Out">
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
          </div>
          <div className="bg-surface-container-low/95 border border-outline-variant p-1.5 space-y-1 text-label-sm font-label-sm w-36">
            <span className="text-on-surface-variant uppercase text-[8px] font-bold block mb-0.5">Canvas Layers</span>
            <label className="flex items-center space-x-1.5 cursor-pointer text-[10px]">
              <input
                checked={showReflectivity}
                onChange={(e) => setShowReflectivity(e.target.checked)}
                type="checkbox"
                className="w-3 h-3 text-primary"
                style={{ marginRight: "4px" }}
              />
              <span className="text-primary font-bold">Reflectivity</span>
            </label>
            <label className="flex items-center space-x-1.5 text-[10px] opacity-60 cursor-default">
              <input disabled type="checkbox" className="w-3 h-3" style={{ marginRight: "4px" }} />
              <span className="text-on-surface-variant">Satellite (research)</span>
            </label>
            <label className="flex items-center space-x-1.5 text-[10px] opacity-60 cursor-default">
              <input disabled type="checkbox" className="w-3 h-3" style={{ marginRight: "4px" }} />
              <span className="text-on-surface-variant">Lightning (research)</span>
            </label>
          </div>
        </div>

        <div className="absolute bottom-12 right-3 z-20 bg-surface-container-lowest/90 border border-outline-variant p-1.5 text-label-sm font-label-sm">
          <div className="flex justify-between items-center mb-1 text-[8px] text-on-surface-variant font-mono">
            <span>dBZ SCALE</span>
            <span>REFLECTIVITY</span>
          </div>
          <div className="flex items-center h-2.5 w-48 border border-outline-variant overflow-hidden">
            <div className="flex-1 h-full bg-[#193944]"></div>
            <div className="flex-1 h-full bg-[#56A3A6]"></div>
            <div className="flex-1 h-full bg-[#87D3D6]"></div>
            <div className="flex-1 h-full bg-[#E3B505]"></div>
            <div className="flex-1 h-full bg-[#DB504A]"></div>
            <div className="flex-1 h-full bg-[#ffb4ab]"></div>
          </div>
          <div className="flex justify-between text-[8px] font-mono text-on-surface-variant mt-0.5">
            <span>10</span>
            <span>25</span>
            <span>40</span>
            <span>50</span>
            <span>60</span>
            <span>75+</span>
          </div>
        </div>
      </div>

      <div className="w-full bg-surface-container border-t border-outline-variant p-2 flex items-center justify-between text-label-sm font-label-sm z-30 font-mono">
        <div className="flex items-center space-x-2">
          <span className="text-on-surface-variant uppercase font-semibold" style={{ marginRight: "8px" }}>Temporal Frame:</span>
          <div className="inline-flex border border-outline-variant p-0.5 bg-surface-container-lowest">
            {data.frames?.map((f, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setFrameIndex && setFrameIndex(idx)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                  idx === frameIndex
                    ? "bg-primary text-on-primary-container font-bold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                style={{ marginRight: "4px" }}
              >
                {formatLead(f.lead_minutes)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-on-surface-variant">
            LEAD: {formatLead(frame?.lead_minutes ?? 0)}
          </span>
          <div className="w-28 bg-surface-container-highest h-2 relative border border-outline-variant" style={{ margin: "0 8px" }}>
            <div className="bg-primary h-full" style={{ width: `${Math.min(100, ((frame?.lead_minutes || 0) / 60) * 100)}%` }}></div>
          </div>
          <span className="text-tertiary font-mono font-bold">
            {frame?.valid_time_utc ? String(frame.valid_time_utc).replace("T", " ").replace(".000Z", "Z") : "VALID TIME UNAVAILABLE"}
          </span>
        </div>
      </div>
    </section>
  );
}
