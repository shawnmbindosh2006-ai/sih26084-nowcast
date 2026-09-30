import React from "react";
import { methodLabel, sourceDisplay } from "../dashboardModel.js";

export function StormRecordCard() {
  return (
    <div className="border border-outline-variant bg-surface-container-low p-2.5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-outline-variant pb-1.5 mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-primary inline-block" style={{ marginRight: "6px" }}></span>
          <h2 className="text-label-md font-label-md uppercase font-bold text-primary tracking-wider">STORM RECORD</h2>
        </div>
        <span className="px-1.5 py-0.5 text-label-sm font-label-sm border border-outline-variant text-tertiary bg-surface-container uppercase font-bold text-[9px]">
          RESEARCH LAYER
        </span>
      </div>

      <div className="text-[10px] text-on-surface-variant mb-2">
        Tracking architecture ready
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-label-sm font-label-sm mb-2.5 text-[11px]">
        <div className="bg-surface-container px-2 py-1 border border-outline-variant/60">
          <span className="text-on-surface-variant block text-[9px]">Identity:</span>
          <span className="text-on-surface font-mono font-medium text-[10px]">Not computed for current replay</span>
        </div>
        <div className="bg-surface-container px-2 py-1 border border-outline-variant/60">
          <span className="text-on-surface-variant block text-[9px]">Lifecycle:</span>
          <span className="text-tertiary font-mono font-medium text-[10px]">Awaiting storm-object analysis</span>
        </div>
        <div className="bg-surface-container px-2 py-1 border border-outline-variant/60">
          <span className="text-on-surface-variant block text-[9px]">Motion History:</span>
          <span className="text-on-surface font-mono font-medium text-[10px]">Available when tracking is enabled</span>
        </div>
        <div className="bg-surface-container px-2 py-1 border border-outline-variant/60">
          <span className="text-on-surface-variant block text-[9px]">Split / Merge:</span>
          <span className="text-on-surface-variant font-mono font-medium text-[10px]">Not evaluated</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-1 flex justify-between text-[9px]">
          <span>Lifecycle Evolution</span>
          <span className="text-tertiary font-mono">STANDBY</span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
          <div className="p-1 border border-outline-variant bg-surface-container text-on-surface-variant">
            <span className="block opacity-60">INITIATION</span>
          </div>
          <div className="p-1 border border-outline-variant bg-surface-container text-on-surface-variant">
            <span className="block opacity-60">INTENSIFY</span>
          </div>
          <div className="p-1 border border-outline-variant bg-surface-container text-on-surface-variant">
            <span className="block opacity-60">MATURE</span>
          </div>
          <div className="p-1 border border-outline-variant bg-surface-container text-on-surface-variant">
            <span className="block opacity-60">DISSIPATE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvidenceStreamsCard({ data = {} }) {
  const radarSourceText = sourceDisplay(data);

  return (
    <div className="space-y-1.5 font-mono text-xs">
      <div className="flex items-center justify-between px-1">
        <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wider text-[10px]">EVIDENCE STREAMS</span>
        <span className="text-label-sm font-label-sm text-on-surface-variant text-[9px]">1 ACTIVE / 3 RESEARCH</span>
      </div>

      <div className="border border-primary/50 bg-surface-container-low p-2 relative">
        <div className="flex justify-between items-center text-label-sm font-label-sm border-b border-outline-variant/60 pb-1 mb-1">
          <span className="text-primary font-bold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-primary inline-block" style={{ marginRight: "4px" }}></span>
            <span>RADAR</span>
          </span>
          <span className="text-primary bg-primary/10 px-1 font-mono text-[9px]">ACTIVE</span>
        </div>
        <p className="text-body-sm font-body-sm text-on-surface mb-1 text-[11px] truncate">{radarSourceText}</p>
        <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
          <span className="font-mono text-primary">Method: {methodLabel(data.method)}</span>
          <span className="text-primary font-bold">CONNECTED</span>
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container-low p-2">
        <div className="flex justify-between items-center text-label-sm font-label-sm border-b border-outline-variant/60 pb-1 mb-1">
          <span className="text-on-surface-variant font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-outline inline-block" style={{ marginRight: "4px" }}></span>
            <span>SATELLITE</span>
          </span>
          <span className="text-on-surface-variant font-mono text-[9px]">RESEARCH LAYER</span>
        </div>
        <p className="text-body-sm font-body-sm text-on-surface-variant mb-1 text-[10px]">Not connected in current run</p>
        <div className="flex items-center justify-between text-[9px] text-on-surface-variant">
          <span className="font-mono text-outline">Proposed architecture</span>
          <span className="text-outline border border-outline-variant px-1">INACTIVE</span>
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container-low p-2">
        <div className="flex justify-between items-center text-label-sm font-label-sm border-b border-outline-variant/60 pb-1 mb-1">
          <span className="text-on-surface-variant font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-outline inline-block" style={{ marginRight: "4px" }}></span>
            <span>LIGHTNING</span>
          </span>
          <span className="text-on-surface-variant font-mono text-[9px]">RESEARCH LAYER</span>
        </div>
        <p className="text-body-sm font-body-sm text-on-surface-variant mb-1 text-[10px]">Not connected in current run</p>
        <div className="flex items-center justify-between text-[9px] text-on-surface-variant">
          <span className="font-mono text-outline">Proposed architecture</span>
          <span className="text-outline border border-outline-variant px-1">INACTIVE</span>
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container-low p-2">
        <div className="flex justify-between items-center text-label-sm font-label-sm border-b border-outline-variant/60 pb-1 mb-1">
          <span className="text-on-surface-variant font-semibold flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-outline inline-block" style={{ marginRight: "4px" }}></span>
            <span>ENVIRONMENT</span>
          </span>
          <span className="text-on-surface-variant font-mono text-[9px]">RESEARCH LAYER</span>
        </div>
        <p className="text-body-sm font-body-sm text-on-surface-variant mb-1 text-[10px]">Not connected in current run</p>
        <div className="flex items-center justify-between text-[9px] text-on-surface-variant">
          <span className="font-mono text-outline">Proposed architecture</span>
          <span className="text-outline border border-outline-variant px-1">INACTIVE</span>
        </div>
      </div>
    </div>
  );
}

export function ForecastEnginePipelineCard({ method = "fixture" }) {
  const activeMethodName = methodLabel(method);

  return (
    <div className="border border-outline-variant bg-surface-container-low p-2.5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-outline-variant pb-1.5 mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-sm text-tertiary" style={{ marginRight: "4px" }}>alt_route</span>
          <h2 className="text-label-md font-label-md uppercase font-bold text-primary tracking-wider">FORECAST ENGINE</h2>
        </div>
        <span className="text-label-sm font-label-sm font-mono text-tertiary text-[10px]">ADAPTIVE ROUTING</span>
      </div>

      <div className="relative space-y-2 text-label-sm font-label-sm pl-3 border-l-2 border-outline-variant">
        <div className="relative">
          <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-primary rounded-none border border-background"></div>
          <div className="p-2 border border-primary bg-primary/10">
            <div className="flex justify-between items-center font-bold text-primary text-[11px]">
              <span>0–30 MIN</span>
              <span className="text-[8px] bg-primary text-on-primary-container px-1">ACTIVE</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface mt-0.5 text-[11px]">
              {activeMethodName}
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-surface-variant rounded-none border border-outline-variant"></div>
          <div className="p-2 border border-outline-variant bg-surface-container">
            <div className="flex justify-between items-center text-on-surface-variant font-semibold text-[11px]">
              <span>30–90 MIN: STORM EVOLUTION</span>
              <span className="text-on-surface-variant font-mono text-[8px]">RESEARCH LAYER</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5 text-[10px]">
              Proposed growth and decay routing beyond the current nowcast provider.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-surface-variant rounded-none border border-outline-variant"></div>
          <div className="p-2 border border-outline-variant bg-surface-container">
            <div className="flex justify-between items-center text-on-surface-variant font-semibold text-[11px]">
              <span>1–3 HR: MULTI-SENSOR GUIDANCE</span>
              <span className="text-on-surface-variant font-mono text-[8px]">RESEARCH LAYER</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5 text-[10px]">
              Proposed fusion of additional sensors when those feeds are connected.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-[19px] top-1.5 w-3 h-3 bg-surface-variant rounded-none border border-outline-variant"></div>
          <div className="p-2 border border-outline-variant bg-surface-container">
            <div className="flex justify-between items-center text-on-surface-variant font-semibold text-[11px]">
              <span>3–6 HR: WEATHER-MODEL HANDOFF</span>
              <span className="text-on-surface-variant font-mono text-[8px]">RESEARCH LAYER</span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5 text-[10px]">
              Proposed handoff to numerical weather guidance. Not executed in the current run.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 bg-surface-container-lowest p-2 border border-outline-variant">
        <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
          <span className="uppercase">Current provider:</span>
          <span className="font-mono text-primary font-bold text-right">{activeMethodName}</span>
        </div>
        <div className="w-full h-1.5 bg-surface-container flex">
          <div className="h-full bg-primary w-full"></div>
        </div>
      </div>
    </div>
  );
}

export function DecisionViewCard() {
  return (
    <div className="border border-outline-variant bg-surface-container-lowest p-3 relative overflow-hidden flex flex-col justify-between font-mono text-xs">
      <div>
        <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-2">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-primary" style={{ marginRight: "6px" }}>gavel</span>
            <h3 className="text-label-md font-label-md uppercase font-bold text-primary tracking-wider">DECISION VIEW</h3>
          </div>
          <span className="px-2 py-0.5 text-label-sm font-label-sm font-mono bg-surface-container text-tertiary border border-outline-variant font-bold uppercase text-[10px]">
            RESEARCH LAYER
          </span>
        </div>
        <div className="space-y-1.5 text-body-sm font-body-sm text-[11px]">
          <div className="flex justify-between items-baseline border-b border-outline-variant/40 pb-1">
            <span className="text-on-surface-variant uppercase text-label-sm font-label-sm">LIKELY PATH:</span>
            <span className="text-on-surface font-medium">Not computed for current event</span>
          </div>
          <div className="flex justify-between items-baseline border-b border-outline-variant/40 pb-1">
            <span className="text-on-surface-variant uppercase text-label-sm font-label-sm">ARRIVAL WINDOW:</span>
            <span className="text-tertiary font-mono">Requires georeferenced tracked storm</span>
          </div>
          <div className="flex justify-between items-baseline border-b border-outline-variant/40 pb-1">
            <span className="text-on-surface-variant uppercase text-label-sm font-label-sm">CONFIDENCE:</span>
            <span className="text-primary font-mono">Evidence assessment pending</span>
          </div>
          <div className="flex justify-between items-baseline border-b border-outline-variant/40 pb-1">
            <span className="text-on-surface-variant uppercase text-label-sm font-label-sm">ACTION TIME:</span>
            <span className="text-on-surface-variant font-mono">Requires location-specific evaluation</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant">
        <div>
          <span className="text-[9px] font-label-sm text-outline uppercase font-bold block">ARRIVAL CORRIDOR:</span>
          <span className="text-on-surface font-mono">Awaiting location-specific asset mapping</span>
        </div>
      </div>
    </div>
  );
}

export function EvidenceReplayControlsCard({ data = {} }) {
  return (
    <div className="border border-outline-variant bg-surface-container p-2.5 flex flex-col justify-between font-mono text-xs">
      <div>
        <div className="flex items-center justify-between border-b border-outline-variant pb-1 mb-2">
          <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wider text-[10px]">EVIDENCE REPLAY</span>
          <span className="px-1.5 py-0.5 text-label-sm font-label-sm border border-outline-variant text-primary font-mono text-[9px]">
            CURRENT RUN
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[9px] font-label-sm mb-2">
          <label className="flex items-center space-x-1 bg-surface-container-low p-1 border border-outline-variant cursor-default">
            <input checked readOnly className="w-2.5 h-2.5 text-primary" style={{ marginRight: "4px" }} type="checkbox" />
            <span className="text-primary font-mono font-bold">✓ RADAR FRAME</span>
          </label>
          <label className="flex items-center space-x-1 bg-surface-container-low p-1 border border-outline-variant/40 cursor-default opacity-60">
            <input disabled className="w-2.5 h-2.5 text-outline" style={{ marginRight: "4px" }} type="checkbox" />
            <span className="text-outline font-mono">SATELLITE (RESEARCH)</span>
          </label>
        </div>
        <div className="bg-surface-container-lowest p-1.5 border border-outline-variant text-[9px] font-label-sm mb-2">
          <div className="text-on-surface-variant uppercase font-bold mb-0.5">VERIFICATION STATE:</div>
          <div className="flex justify-between items-center text-on-surface">
            <span>Single-source current run</span>
            <span className="text-primary font-mono">NO SKILL SCORE</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] mb-1 font-mono text-on-surface-variant">
          <span>FRAME TIMELINE: [{data.frames?.map((f) => `+${f.lead_minutes}m`).join(", ") || "+0m"}]</span>
        </div>
      </div>
    </div>
  );
}

export function ScienceResearchFullSection({ data = {} }) {
  return (
    <section className="mt-6 border-t-2 border-outline-variant bg-surface-container-low p-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-4">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-primary text-lg" style={{ marginRight: "6px" }}>science</span>
          <h2 className="text-headline-md font-headline-md text-primary font-bold uppercase tracking-wide text-base">
            RESEARCH ARCHITECTURE
          </h2>
        </div>
        <span className="px-2 py-0.5 bg-surface-container text-tertiary border border-outline-variant text-[10px] font-bold">
          PROPOSED · NOT CURRENT RUN SKILL
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-[11px] leading-relaxed">
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Storm lineage</h4>
          <p className="text-on-surface-variant">
            Object tracking would record initiation, split, merge and dissipation as a storm identity over successive radar frames.
          </p>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Adaptive forecast routing</h4>
          <p className="text-on-surface-variant">
            Short leads stay on the advertised nowcast provider. Longer horizons are routed to research stages rather than fabricated skill.
          </p>
          <div className="mt-2 text-[9px] text-tertiary border-t border-outline-variant pt-1 font-bold">
            Current provider: {methodLabel(data.method)}
          </div>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Multi-sensor fusion</h4>
          <p className="text-on-surface-variant">
            Satellite, lightning and environmental fields are designed as optional evidence channels. They are inactive until a connected source exists.
          </p>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Probabilistic uncertainty</h4>
          <p className="text-on-surface-variant">
            Calibrated probabilities are shown only when the backend returns a validated hazard probability. Otherwise the panel stays pending.
          </p>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Hazard-specific evidence</h4>
          <p className="text-on-surface-variant">
            Lightning, hail, cloudburst and downburst remain independent channels. Reflectivity is not treated as rainfall, hail size or wind.
          </p>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Arrival corridors</h4>
          <p className="text-on-surface-variant">
            Path and arrival timing require a georeferenced tracked storm and a location of interest. Neither is computed in the current event.
          </p>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Evidence replay</h4>
          <p className="text-on-surface-variant">
            Replay inspects issued frames, valid times and artifacts from the saved run. It does not invent CSI, accuracy or operational uptime.
          </p>
          <div className="mt-2 text-[9px] text-primary border-t border-outline-variant pt-1 font-bold">
            Leads: [{data.frames?.map((f) => `+${f.lead_minutes}m`).join(", ") || "none"}]
          </div>
        </div>
        <div className="bg-surface-container p-3 border border-outline-variant">
          <h4 className="text-primary font-bold text-xs uppercase mb-1">Schema</h4>
          <p className="text-on-surface-variant">
            Display is bound to ForecastBundle v1.0: mode, method, grid bounds, frames, hazards and warnings from the API.
          </p>
        </div>
      </div>
    </section>
  );
}
