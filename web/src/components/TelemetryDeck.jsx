import React from "react";
import { forecastRunUrl, resolveArtifactUrl, sourceDisplay, qualityCoverageText } from "../dashboardModel.js";

export function TelemetryDeck({ data, apiBase }) {
  const frame = data.frames?.[0];
  const imageUrl = resolveArtifactUrl(frame?.image_url, apiBase);
  const npyUrl = resolveArtifactUrl(frame?.array_url || frame?.npy_url, apiBase);
  const runUrl = forecastRunUrl(apiBase, data.runId);
  const sourceText = sourceDisplay(data);
  const coverage = qualityCoverageText(data);

  return (
    <div className="border border-outline-variant bg-surface-container-low p-2.5 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-outline-variant pb-1.5 mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-sm text-primary" style={{ marginRight: "4px" }}>verified_user</span>
          <h2 className="text-label-md font-label-md uppercase font-bold text-primary tracking-wider">TRUST LEDGER</h2>
        </div>
        <span className="text-label-sm font-label-sm font-mono px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/40 font-semibold">
          EVENT METADATA
        </span>
      </div>

      <div className="space-y-2 text-label-sm font-label-sm">
        <div className="border-b border-outline-variant/40 pb-1.5">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-on-surface-variant font-medium">SOURCE PROVENANCE</span>
            <span className="text-primary font-mono font-bold">VERIFIED FROM EVENT METADATA</span>
          </div>
          <div className="text-body-sm font-body-sm text-on-surface text-[11px] break-words">{sourceText}</div>
        </div>

        <div className="border-b border-outline-variant/40 pb-1.5">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-on-surface-variant font-medium">DATA COVERAGE</span>
            <span className="text-tertiary font-mono font-bold">QUALITY MASK</span>
          </div>
          <div className="text-body-sm font-body-sm text-on-surface text-[11px]">{coverage}</div>
        </div>

        <div className="border-b border-outline-variant/40 pb-1.5">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-on-surface-variant font-medium">SENSOR AGREEMENT</span>
            <span className="text-on-surface-variant font-mono font-bold">NOT EVALUATED</span>
          </div>
          <div className="text-body-sm font-body-sm text-on-surface text-[11px]">
            Multi-sensor agreement is not computed for this run.
          </div>
        </div>

        <div className="bg-surface-container px-2 py-1 flex items-center justify-between border border-outline-variant mb-2">
          <span className="text-on-surface-variant text-[9px] uppercase">MULTI-SENSOR STATUS:</span>
          <span className="text-primary font-mono text-[9px] font-bold">SINGLE-SOURCE CURRENT RUN</span>
        </div>

        <div className="bg-surface-container-lowest p-2 border border-outline-variant space-y-1">
          <div className="text-[9px] text-on-surface-variant uppercase font-bold mb-1">RUN ARTIFACTS:</div>
          <div className="flex flex-col space-y-1 text-[11px]">
            {imageUrl ? (
              <a href={imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center space-x-1">
                <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>image</span>
                <span className="truncate">Forecast PNG</span>
              </a>
            ) : (
              <div className="text-outline">PNG Artifact: Not available</div>
            )}
            {npyUrl ? (
              <a href={npyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center space-x-1">
                <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>download</span>
                <span className="truncate">NPY Artifact</span>
              </a>
            ) : (
              <div className="text-outline">NPY Artifact: Not available</div>
            )}
            {runUrl && (
              <a href={runUrl} target="_blank" rel="noreferrer" className="text-tertiary hover:underline flex items-center space-x-1">
                <span className="material-symbols-outlined text-xs" style={{ marginRight: "4px" }}>api</span>
                <span className="truncate">Saved Run Endpoint</span>
              </a>
            )}
            {data.runId && (
              <div className="text-on-surface-variant text-[10px]">Run ID: {data.runId}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
