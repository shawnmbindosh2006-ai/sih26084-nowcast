import React from "react";
import { hazardPresentation } from "../dashboardModel.js";

const UNAVAILABLE_COPY = {
  lightning: {
    value: "Awaiting supporting evidence",
    detail: "Lightning evidence is not connected in the current run.",
  },
  hail: {
    value: "Insufficient evidence",
    detail: "Hail assessment is not available for this event.",
  },
  cloudburst: {
    value: "Rainfall evidence unavailable",
    detail: "Rainfall-rate evidence is not supplied for this run.",
  },
  downburst: {
    value: "Wind evidence unavailable",
    detail: "Wind / downburst evidence is not supplied for this run.",
  },
};

function presentHazard(kind, hazard) {
  const info = hazardPresentation(hazard);
  if (info.status !== "UNAVAILABLE") return info;
  const copy = UNAVAILABLE_COPY[kind];
  return copy ? { ...info, value: copy.value, reason: copy.detail } : info;
}

export function HazardMatrix({ hazards = {} }) {
  const lightningInfo = presentHazard("lightning", hazards.lightning);
  const hailInfo = presentHazard("hail", hazards.hail);
  const cloudburstInfo = presentHazard("cloudburst", hazards.cloudburst);
  const downburstInfo = presentHazard("downburst", hazards.downburst);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-xs">
      <div className="border border-outline-variant bg-surface-container p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-label-sm font-label-sm mb-1">
            <span className="text-tertiary font-bold flex items-center space-x-1">
              <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>bolt</span>
              <span>LIGHTNING</span>
            </span>
            <span className="text-secondary font-mono font-bold">{lightningInfo.status}</span>
          </div>
          <div className="text-label-sm font-label-sm text-on-surface font-mono font-bold text-sm">{lightningInfo.value}</div>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 text-[11px] leading-tight">
            {lightningInfo.reason}
          </p>
        </div>
        <div className="text-[9px] font-label-sm text-tertiary border-t border-outline-variant pt-1 mt-2 font-mono">
          Research layer until flash evidence is attached
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-label-sm font-label-sm mb-1">
            <span className="text-secondary font-bold flex items-center space-x-1">
              <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>ac_unit</span>
              <span>HAIL</span>
            </span>
            <span className="text-secondary font-mono font-bold">{hailInfo.status}</span>
          </div>
          <div className="text-label-sm font-label-sm text-on-surface font-mono font-bold text-sm">{hailInfo.value}</div>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 text-[11px] leading-tight">
            {hailInfo.reason}
          </p>
        </div>
        <div className="text-[9px] font-label-sm text-secondary border-t border-outline-variant pt-1 mt-2 font-mono">
          No hail size is inferred from reflectivity alone
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-label-sm font-label-sm mb-1">
            <span className="text-primary font-bold flex items-center space-x-1">
              <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>water_drop</span>
              <span>CLOUDBURST</span>
            </span>
            <span className="text-tertiary font-mono font-bold">{cloudburstInfo.status}</span>
          </div>
          <div className="text-label-sm font-label-sm text-on-surface font-mono font-bold text-sm">{cloudburstInfo.value}</div>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 text-[11px] leading-tight">
            {cloudburstInfo.reason}
          </p>
        </div>
        <div className="text-[9px] font-label-sm text-primary border-t border-outline-variant pt-1 mt-2 font-mono">
          Reflectivity is not rainfall in mm/h
        </div>
      </div>

      <div className="border border-outline-variant bg-surface-container p-2.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-label-sm font-label-sm mb-1">
            <span className="text-on-surface font-bold flex items-center space-x-1">
              <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>air</span>
              <span>DOWNBURST</span>
            </span>
            <span className="text-secondary font-mono font-bold">{downburstInfo.status}</span>
          </div>
          <div className="text-label-sm font-label-sm text-on-surface font-mono font-bold text-sm">{downburstInfo.value}</div>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 text-[11px] leading-tight">
            {downburstInfo.reason}
          </p>
        </div>
        <div className="text-[9px] font-label-sm text-on-surface-variant border-t border-outline-variant pt-1 mt-2 font-mono">
          Wind evidence is a separate research channel
        </div>
      </div>
    </div>
  );
}
