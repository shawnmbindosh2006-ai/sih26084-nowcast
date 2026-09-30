import React, { useState } from "react";
import { RadarGIS } from "./components/RadarGIS.jsx";
import { HazardMatrix } from "./components/HazardMatrix.jsx";
import { TelemetryDeck } from "./components/TelemetryDeck.jsx";
import {
  StormRecordCard,
  EvidenceStreamsCard,
  ForecastEnginePipelineCard,
  DecisionViewCard,
  EvidenceReplayControlsCard,
  ScienceResearchFullSection,
} from "./components/ResearchModules.jsx";
import {
  methodLabel,
  modeLabel,
  formatLead,
  sourceDisplay,
  geographyDisplay,
  variableDisplay,
  unitsDisplay,
  leadAvailabilityText,
  looksLikeMrmsReplay,
  isSyntheticMode,
} from "./dashboardModel.js";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCLq3BKHa-OWPTlVepvf_F3K0BDN2vddsVMWFSEMjV0DKNMcGM1XWF8IIGULhcT46jtZw79T_APZyNCwCc1pYe6j2IG29l4ZgaD2FF1YQutQcxhuk0g-xO-RqjLlX0pM3ZSip4WSx-98TZHQ2T416KctCptMcantGIHF1uLcJ0ucrdBL8e6pvK2Y_sPehDVmAIxC6aYi_fENUWVLvbfETlGSPEcY17i2TzbwbyHyjY6XTsVoIuHk8Y74exyijZd6EqSwQ";

function fmtUtc(value) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toISOString().replace("T", " ").replace(".000Z", "Z")
    : "Unavailable";
}

function scrollToId(id) {
  const node = document.getElementById(id);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Workstation({
  data,
  discovery,
  selectedMethod,
  selectMethod,
  selectedEvent,
  setSelectedEvent,
  selectedLead,
  setSelectedLead,
  generateForecast,
  apiState,
  error,
  apiBase,
  onGoToLanding,
}) {
  const [activeNavTab, setActiveNavTab] = useState("radar");
  const [frameIndex, setFrameIndex] = useState(0);

  const availableMethods = discovery ? Object.keys(discovery.availablePipelines) : [];
  const pipeline = discovery?.availablePipelines[selectedMethod] || null;
  const eventsList = discovery?.events || [];
  const leadOptions =
    pipeline?.supported_lead_times_minutes ||
    data.frames?.map((frame) => frame.lead_minutes).filter((lead) => Number.isInteger(lead)) ||
    [];

  const currentFrame = data.frames?.[frameIndex] || data.frames?.[0];
  const validTimeUtc = currentFrame?.valid_time_utc || data.issueTimeUtc;
  const sourceText = sourceDisplay(data);
  const geographyText = geographyDisplay(data);
  const mrmsReplay = looksLikeMrmsReplay(data);
  const synthetic = isSyntheticMode(data.mode);

  const navClass = (id) =>
    `py-2 px-3 text-label-md font-label-md flex items-center space-x-1.5 transition-colors border-b-2 ${
      activeNavTab === id
        ? "border-primary text-primary font-bold bg-surface-container-high/40"
        : "border-transparent text-on-surface-variant hover:text-on-surface"
    }`;

  return (
    <div className="ws-shell ws-dense min-h-screen bg-surface-dim text-on-surface select-none overflow-x-hidden flex flex-col font-sans">
      <header className="ws-topbar flex justify-between items-center w-full px-4 h-14 bg-surface-container border-b border-outline-variant sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="h-8 flex items-center pr-2">
            <img
              alt="VajraVIEW Logo"
              className="h-7 w-auto object-contain brightness-110"
              src={LOGO_URL}
              style={{ maxHeight: "28px", height: "28px" }}
            />
          </div>
          <div className="hidden xl:block border-l border-outline-variant pl-3 font-mono leading-tight">
            <div className="text-[9px] tracking-[0.22em] text-primary font-bold">EVIDENCE BEFORE IMPACT</div>
            <div className="text-[8px] tracking-[0.14em] text-on-surface-variant">CONVECTIVE NOWCAST COMMAND DECK</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1 font-mono">
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("live");
              scrollToId("nowcast-controls");
            }}
            className={navClass("live")}
            style={{ marginRight: "4px" }}
          >
            LIVE NOWCAST
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("radar");
              scrollToId("radar-gis");
            }}
            className={navClass("radar")}
            style={{ marginRight: "4px" }}
          >
            RADAR GIS
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("hazards");
              scrollToId("hazard-intelligence");
            }}
            className={navClass("hazards")}
            style={{ marginRight: "4px" }}
          >
            HAZARD INTELLIGENCE
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("telemetry");
              scrollToId("telemetry-deck");
            }}
            className={navClass("telemetry")}
            style={{ marginRight: "4px" }}
          >
            TELEMETRY
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("research");
              scrollToId("research-architecture");
            }}
            className={navClass("research")}
            style={{ marginRight: "4px" }}
          >
            RESEARCH
          </button>
          <button
            type="button"
            onClick={onGoToLanding}
            className="py-2 px-3 text-label-md font-label-md flex items-center space-x-1.5 transition-colors border-b-2 border-transparent text-on-surface-variant hover:text-primary"
          >
            LANDING
          </button>
        </nav>

        <div className="flex items-center space-x-2.5 font-mono">
          <div className="flex items-center space-x-2 bg-surface-container-lowest px-2.5 py-1 border border-outline-variant text-label-sm font-label-sm">
            <span className="flex h-1.5 w-1.5 relative" style={{ marginRight: "4px" }}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
            </span>
            <span className="text-primary font-semibold">SYSTEM READY</span>
            <span className="text-outline-variant">|</span>
            <span className="text-tertiary font-bold tracking-wider">{modeLabel(data.mode)}</span>
          </div>
        </div>
      </header>

      <section className="ws-command-rail" aria-label="Current run status">
        <div className="ws-command-cell ws-command-accent">
          <span>RUN STATE</span>
          <strong>{apiState === "loading" ? "COMPUTING" : apiState === "ready" ? "API READY" : "LOCAL FIXTURE"}</strong>
        </div>
        <div className="ws-command-cell">
          <span>DATA MODE</span>
          <strong>{modeLabel(data.mode)}</strong>
        </div>
        <div className="ws-command-cell">
          <span>ACTIVE PROVIDER</span>
          <strong>{methodLabel(data.method)}</strong>
        </div>
        <div className="ws-command-cell">
          <span>DISPLAY FRAME</span>
          <strong>{formatLead(currentFrame?.lead_minutes ?? 0)}</strong>
        </div>
        <div className="ws-command-cell ws-command-warning">
          <span>HAZARD CLAIMS</span>
          <strong>BACKEND EVIDENCE ONLY</strong>
        </div>
      </section>

      <section
        id="nowcast-controls"
        className="w-full bg-[#001f29] border-b border-[#3f4949] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs z-40"
      >
        <form onSubmit={generateForecast} className="flex flex-wrap items-center gap-3 w-full justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-[#001017] p-1 border border-[#87d3d6]">
              <span className="text-[#87d3d6] font-bold text-[10px] uppercase px-1.5 py-0.5 bg-[#193944]" style={{ marginRight: "4px" }}>
                [ EVENT / DATASET ]
              </span>
              {eventsList.length > 0 ? (
                <select
                  value={selectedEvent || data.eventId || ""}
                  onChange={(e) => setSelectedEvent && setSelectedEvent(e.target.value)}
                  disabled={apiState === "loading"}
                  className="bg-[#001017] text-[#c8e7f7] font-bold border-none text-xs focus:outline-none cursor-pointer"
                >
                  {eventsList.map((e) => (
                    <option key={e.event_id} value={e.event_id}>
                      {e.event_id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedEvent || data.eventId || ""}
                  onChange={(e) => setSelectedEvent && setSelectedEvent(e.target.value)}
                  placeholder="e.g. synthetic-demo-001"
                  disabled={apiState === "loading"}
                  className="bg-[#001017] text-[#c8e7f7] font-bold border-none text-xs w-44 focus:outline-none"
                />
              )}
            </div>

            <div className="flex items-center space-x-2 bg-[#001017] p-1 border border-[#87d3d6]">
              <span className="text-[#87d3d6] font-bold text-[10px] uppercase px-1.5 py-0.5 bg-[#193944]" style={{ marginRight: "4px" }}>
                [ FORECAST METHOD ]
              </span>
              <select
                value={selectedMethod || data.method || ""}
                onChange={(e) => selectMethod && selectMethod(e.target.value)}
                disabled={!availableMethods.length || apiState === "loading"}
                className="bg-[#001017] text-[#87d3d6] font-bold border-none text-xs focus:outline-none cursor-pointer"
              >
                {availableMethods.length ? (
                  availableMethods.map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)} ({m})
                    </option>
                  ))
                ) : (
                  <option value={data.method}>{methodLabel(data.method)}</option>
                )}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-[#001017] p-1 border border-[#87d3d6]">
              <span className="text-[#87d3d6] font-bold text-[10px] uppercase px-1.5 py-0.5 bg-[#193944]" style={{ marginRight: "4px" }}>
                [ LEAD TIME ]
              </span>
              <div className="flex items-center space-x-1">
                {leadOptions.map((lead) => (
                  <button
                    type="button"
                    key={lead}
                    onClick={() => setSelectedLead && setSelectedLead(lead)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold border transition-colors ${
                      selectedLead === lead
                        ? "bg-[#87d3d6] text-[#003738] border-[#87d3d6]"
                        : "bg-[#001f29] text-[#bec9c9] border-[#3f4949] hover:border-[#87d3d6]"
                    }`}
                    style={{ marginRight: "3px" }}
                  >
                    {formatLead(lead)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                if (eventsList.length > 0) setSelectedEvent(eventsList[0].event_id);
                if (availableMethods.length > 0) selectMethod(availableMethods[0]);
              }}
              className="px-3 py-1.5 bg-[#001017] hover:bg-[#193944] text-[#bec9c9] border border-[#3f4949] font-bold text-xs uppercase"
              style={{ marginRight: "6px" }}
            >
              Reset Event
            </button>

            <button
              type="submit"
              disabled={apiState === "loading"}
              className="px-5 py-1.5 bg-[#56a3a6] hover:bg-[#87d3d6] text-[#003738] font-bold text-xs uppercase tracking-wider border border-[#87d3d6] transition-all flex items-center space-x-1.5 shadow-[0_0_10px_rgba(135,211,214,0.3)] cursor-pointer"
            >
              {apiState === "loading" ? (
                <>
                  <span className="w-3 h-3 border-2 border-[#003738] border-t-transparent rounded-full animate-spin" style={{ marginRight: "4px" }}></span>
                  <span>COMPUTING NOWCAST...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm font-bold" style={{ marginRight: "4px" }}>play_arrow</span>
                  <span>GENERATE NOWCAST</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <div className="w-full bg-[#001017] border-b border-[#3f4949] px-4 py-1.5 flex flex-wrap items-center justify-between font-mono text-[11px] text-[#bec9c9]">
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">SOURCE:</span>
            <span className="text-[#c8e7f7] font-semibold">{sourceText}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">MODE:</span>
            <span className="text-[#f0c11d] font-bold">{modeLabel(data.mode)}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">GEOGRAPHY:</span>
            <span className="text-[#c8e7f7] font-semibold">{geographyText}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">VARIABLE:</span>
            <span className="text-[#87d3d6] font-semibold">{variableDisplay(currentFrame)}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">UNITS:</span>
            <span className="text-[#87d3d6]">{unitsDisplay(currentFrame)}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">FORECAST METHOD:</span>
            <span className="text-[#87d3d6] font-semibold">{methodLabel(data.method)}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">LEAD:</span>
            <span className="text-[#87d3d6] font-semibold">{formatLead(selectedLead ?? currentFrame?.lead_minutes ?? 0)}</span>
          </div>
          {mrmsReplay && (
            <div className="flex items-center space-x-1">
              <span className="text-[#889393] uppercase">HORIZONS:</span>
              <span className="text-[#c8e7f7] font-semibold">{leadAvailabilityText(leadOptions)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">ISSUE TIME:</span>
            <span className="text-[#c8e7f7]">{fmtUtc(data.issueTimeUtc)}</span>
          </div>
          <div className="flex items-center space-x-1" style={{ marginRight: "12px" }}>
            <span className="text-[#889393] uppercase">VALID TIME:</span>
            <span className="text-[#87d3d6] font-semibold">{fmtUtc(validTimeUtc)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-[#889393] uppercase">RUN STATUS:</span>
            <span className={`font-bold ${apiState === "loading" ? "text-[#f0c11d] animate-pulse" : "text-[#56a3a6]"}`}>
              {apiState === "loading" ? "COMPUTING" : apiState === "ready" ? "READY" : "LOCAL FIXTURE"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#93000a] text-[#ffdad6] px-4 py-1.5 border-b border-[#ffb4ab] font-mono text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-sm" style={{ marginRight: "6px" }}>error</span>
            <span>{error}</span>
          </div>
          <span className="text-[10px] uppercase font-bold">USING LOCAL SYNTHETIC FIXTURE</span>
        </div>
      )}

      <main className="ws-workspace flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-0 relative bg-surface-dim pb-8">
        <aside className="ws-rail lg:col-span-3 border-r border-outline-variant bg-surface-container/60 backdrop-blur-md flex flex-col p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)]">
          <StormRecordCard />
          <EvidenceStreamsCard data={data} />
        </aside>

        <section id="radar-gis" className="ws-core lg:col-span-6 flex flex-col bg-surface-container-lowest border-r border-outline-variant relative overflow-hidden min-h-[520px]">
          <RadarGIS
            data={data}
            frameIndex={frameIndex}
            setFrameIndex={setFrameIndex}
            apiBase={apiBase}
          />
        </section>

        <aside id="telemetry-deck" className="ws-rail lg:col-span-3 border-l border-outline-variant bg-surface-container/60 backdrop-blur-md flex flex-col p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)]">
          <TelemetryDeck data={data} apiBase={apiBase} />
          <ForecastEnginePipelineCard method={data.method} />
        </aside>

        <section className="ws-lower-deck lg:col-span-12 border-t border-outline-variant bg-surface-container-low p-3 grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-4">
            <DecisionViewCard />
          </div>
          <div id="hazard-intelligence" className="xl:col-span-5">
            <HazardMatrix hazards={data.hazards} />
          </div>
          <div className="xl:col-span-3">
            <EvidenceReplayControlsCard data={data} />
          </div>
        </section>

        <div id="research-architecture" className="lg:col-span-12">
          <ScienceResearchFullSection data={data} />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full h-7 px-3 flex justify-between items-center bg-surface-container-lowest border-t border-outline-variant z-40 text-label-sm font-label-sm tracking-wider uppercase font-mono text-[10px]">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 bg-primary animate-pulse" style={{ marginRight: "6px" }}></span>
          <span className="text-primary font-bold">
            VAJRAVIEW · {modeLabel(data.mode)} · {methodLabel(data.method)}
            {synthetic ? " · NO GEOGRAPHIC OR SATELLITE CLAIM" : ""}
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-3 text-on-surface-variant">
          <span>SOURCE: {sourceText}</span>
          <span>•</span>
          <span>SYSTEM READY</span>
        </div>
      </footer>
    </div>
  );
}
