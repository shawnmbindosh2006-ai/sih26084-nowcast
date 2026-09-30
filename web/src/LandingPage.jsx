import React from "react";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCLq3BKHa-OWPTlVepvf_F3K0BDN2vddsVMWFSEMjV0DKNMcGM1XWF8IIGULhcT46jtZw79T_APZyNCwCc1pYe6j2IG29l4ZgaD2FF1YQutQcxhuk0g-xO-RqjLlX0pM3ZSip4WSx-98TZHQ2T416KctCptMcantGIHF1uLcJ0ucrdBL8e6pvK2Y_sPehDVmAIxC6aYi_fENUWVLvbfETlGSPEcY17i2TzbwbyHyjY6XTsVoIuHk8Y74exyijZd6EqSwQ";

export function LandingPage({ onEnterWorkstation }) {
  return (
    <div className="landing-shell min-h-screen bg-[#00161e] text-[#c8e7f7] font-sans selection:bg-[#56a3a6] selection:text-[#00161e]">
      {/* Top Header Navigation */}
      <header className="ws-topbar fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3.5 bg-[#00161e]/90 backdrop-blur-md border-b border-[#3f4949]">
        <div className="flex items-center space-x-3">
          <img src={LOGO_URL} alt="VajraVIEW Logo" className="h-7 w-auto object-contain brightness-110" style={{ maxHeight: "28px" }} />
          <div className="h-4 w-px bg-[#3f4949]" style={{ margin: "0 8px" }}></div>
          <span className="font-mono text-xs text-[#87d3d6] font-bold tracking-widest uppercase">
            SYSTEM READY
          </span>
        </div>

        <nav className="hidden md:flex items-center space-x-6 font-mono text-xs">
          <a href="#gis" className="text-[#bec9c9] hover:text-[#87d3d6] transition-colors" style={{ marginRight: "12px" }}>
            RADAR GIS
          </a>
          <a href="#hazards" className="text-[#bec9c9] hover:text-[#87d3d6] transition-colors" style={{ marginRight: "12px" }}>
            HAZARD INTELLIGENCE
          </a>
          <a href="#telemetry" className="text-[#bec9c9] hover:text-[#87d3d6] transition-colors" style={{ marginRight: "12px" }}>
            TELEMETRY
          </a>
          <a href="#technology" className="text-[#bec9c9] hover:text-[#87d3d6] transition-colors">
            RESEARCH
          </a>
        </nav>

        <button
          onClick={onEnterWorkstation}
          className="flex items-center space-x-2 px-4 py-2 bg-[#56a3a6] hover:bg-[#87d3d6] text-[#003738] font-mono text-xs font-bold transition-all uppercase tracking-wider shadow"
        >
          <span className="material-symbols-outlined text-sm" style={{ marginRight: "4px" }}>file_download_done</span>
          <span>ENTER WORKSTATION</span>
        </button>
      </header>

      {/* Hero Section */}
      <section className="landing-hero pt-28 pb-16 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#00232e] border border-[#3f4949] font-mono text-xs text-[#87d3d6] mb-6">
          <span className="w-2 h-2 rounded-full bg-[#f0c11d] animate-ping" style={{ marginRight: "6px" }}></span>
          <span>RADAR NOWCAST WORKSTATION · SYNTHETIC DEMO AND US ARCHIVED REPLAY</span>
        </div>

        <h1 className="font-headline text-4xl sm:text-6xl font-bold tracking-tight text-[#c8e7f7] max-w-4xl leading-tight mb-6">
          Vajra<span className="text-[#87d3d6]">VIEW</span> Severe Weather Intelligence Platform
        </h1>

        <p className="text-base sm:text-lg text-[#bec9c9] max-w-3xl leading-relaxed mb-8 font-sans">
          VajraVIEW is a dense meteorological workstation for nowcast frames, provenance, and research architecture. Current runs use advertised backend methods only.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 font-mono">
          <button
            onClick={onEnterWorkstation}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#56a3a6] hover:bg-[#87d3d6] text-[#003738] font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined" style={{ marginRight: "6px" }}>file_download_done</span>
            <span>ENTER WORKSTATION</span>
          </button>
          <a
            href="#technology"
            className="w-full sm:w-auto px-8 py-3.5 bg-[#00232e] hover:bg-[#0c2e39] text-[#c8e7f7] border border-[#3f4949] font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
          >
            <span className="material-symbols-outlined" style={{ marginRight: "6px" }}>account_tree</span>
            <span>VIEW SYSTEM ARCHITECTURE</span>
          </a>
        </div>

        {/* Live Telemetry Ticker Banner */}
        <div className="w-full bg-[#001017] border border-[#3f4949] p-4 text-left font-mono text-xs space-y-2">
          <div className="text-[#87d3d6] font-bold uppercase tracking-wider flex items-center space-x-2">
            <span className="material-symbols-outlined text-sm text-[#db504a]" style={{ marginRight: "4px" }}>warning</span>
            <span>WORKSTATION CAPABILITY STRIP</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[#bec9c9]">
            <div className="p-2.5 bg-[#001f29] border border-[#3f4949]">
              <span className="text-[#87d3d6] font-bold">Nowcast providers:</span> Persistence or pySTEPS Lucas–Kanade optical flow when advertised by the API.
            </div>
            <div className="p-2.5 bg-[#001f29] border border-[#3f4949]">
              <span className="text-[#f0c11d] font-bold">Modes:</span> Synthetic demo (local fixture) or US archived MRMS replay. Not a live Indian dual-pol feed.
            </div>
            <div className="p-2.5 bg-[#001f29] border border-[#3f4949]">
              <span className="text-[#db504a] font-bold">Hazards:</span> Shown only from ForecastBundle status. Unsupported channels stay pending, with no invented probabilities.
            </div>
          </div>
        </div>
      </section>

      {/* Operational Pillars Section */}
      <section id="features" className="py-14 px-6 max-w-7xl mx-auto border-t border-[#3f4949]">
        <div className="text-center mb-10">
          <h2 className="font-headline text-2xl sm:text-3xl font-bold text-[#c8e7f7] uppercase tracking-wide">
            OPERATIONAL PILLARS
          </h2>
          <p className="font-mono text-xs text-[#87d3d6] mt-2">
            ENTERPRISE CONVECTIVE REASONING & HAZARD INTELLIGENCE
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">STORM MEMORY</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Storm-object lineage is a proposed research layer. Identity is not computed until tracking is enabled.
            </p>
          </div>

          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">EARLY INITIATION</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Satellite and environmental initiation cues remain research layers until those sensors are connected.
            </p>
          </div>

          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">ADAPTIVE FORECASTING</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Adaptive routing keeps 0–30 min on the advertised nowcast method and labels longer horizons as research.
            </p>
          </div>

          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">TRUST LEDGER</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Provenance and quality-mask fields come from event metadata. Sensor agreement is not evaluated in the current run.
            </p>
          </div>

          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">HAZARD INTELLIGENCE</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Independent hazard cards: lightning, hail, cloudburst and downburst, each pending until supporting evidence exists.
            </p>
          </div>

          <div className="p-5 bg-[#00232e] border border-[#3f4949]">
            <h3 className="font-headline font-bold text-base text-[#87d3d6] mb-2 uppercase">ARRIVAL INTELLIGENCE</h3>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Arrival corridors require a georeferenced tracked storm and a location of interest.
            </p>
          </div>
        </div>
      </section>

      {/* Technology Stack & Architecture Section */}
      <section id="technology" className="py-14 px-6 max-w-7xl mx-auto border-t border-[#3f4949]">
        <div className="text-center mb-10">
          <h2 className="font-headline text-2xl sm:text-3xl font-bold text-[#c8e7f7] uppercase tracking-wide">
            SYSTEM ARCHITECTURE & MATHEMATICAL FOUNDATION
          </h2>
          <p className="font-mono text-xs text-[#87d3d6] mt-2">
            INTEGRATED METEOROLOGICAL DATA ENGINE
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono text-xs mb-10">
          <div className="p-3 bg-[#001f29] border border-[#3f4949]">
            <span className="text-[#87d3d6] font-bold block mb-1">01. INGEST</span>
            <span className="text-[#bec9c9] text-[11px]">Radar / replay event metadata from the API. Satellite, lightning and environment are research layers.</span>
          </div>
          <div className="p-3 bg-[#001f29] border border-[#3f4949]">
            <span className="text-[#87d3d6] font-bold block mb-1">02. FEATURE</span>
            <span className="text-[#bec9c9] text-[11px]">Proposed storm-object features. Not computed for the current replay unless the backend supplies tracking.</span>
          </div>
          <div className="p-3 bg-[#001f29] border border-[#3f4949]">
            <span className="text-[#87d3d6] font-bold block mb-1">03. BLEND</span>
            <span className="text-[#bec9c9] text-[11px]">0–30 min uses Persistence or pySTEPS Lucas–Kanade optical flow when advertised. Longer horizons stay research layers.</span>
          </div>
          <div className="p-3 bg-[#001f29] border border-[#3f4949]">
            <span className="text-[#87d3d6] font-bold block mb-1">04. REASON</span>
            <span className="text-[#bec9c9] text-[11px]">Hazard probabilities display only when ForecastBundle returns a validated value. Otherwise unavailable.</span>
          </div>
          <div className="p-3 bg-[#001f29] border border-[#3f4949]">
            <span className="text-[#87d3d6] font-bold block mb-1">05. IMPACT</span>
            <span className="text-[#bec9c9] text-[11px]">Arrival and asset intersection remain research until a location-specific evaluation is available.</span>
          </div>
        </div>

        {/* Convective Reasoning Deep Algorithmic Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Semi-Lagrangian Optical Flow Vectors</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Optical-flow nowcasting, when selected, uses the advertised pySTEPS Lucas–Kanade provider. It is motion extrapolation, not a validated Indian dual-pol product.
            </p>
          </div>

          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Autonomous Horizon Handoff (0-360m)</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Longer-horizon handoff to storm evolution, multi-sensor guidance and weather-model stages is proposed architecture, not a claim of 0–6 hour skill.
            </p>
          </div>

          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Convective Lifecycle & Mass Flux Tracking</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Storm lineage would attach lifecycle states to tracked objects. Those identities are not computed until tracking is enabled.
            </p>
          </div>

          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Multi-Sensor Space-Time Alignment</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Multi-sensor space-time alignment is a research goal. Satellite and lightning are not connected in the current run.
            </p>
          </div>

          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Stochastic Perturbations & Corridor Spread</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Probabilistic uncertainty and arrival envelopes are research layers. No ensemble size, CSI or accuracy is displayed unless the backend supplies it.
            </p>
          </div>

          <div className="p-5 bg-[#001f29] border border-[#3f4949]">
            <h4 className="font-bold text-[#87d3d6] text-sm mb-2 uppercase">Independent Non-Correlated Threat Channels</h4>
            <p className="text-[#bec9c9] leading-relaxed font-sans">
              Hazard-specific evidence keeps lightning, hail, rainfall and wind on separate channels so reflectivity is not treated as a substitute probability.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-[#3f4949] text-center font-mono">
        <h2 className="font-headline text-2xl sm:text-3xl font-bold text-[#c8e7f7] uppercase tracking-wide mb-4">
          OPEN THE NOWCAST WORKSTATION
        </h2>
        <p className="text-[#bec9c9] max-w-2xl mx-auto mb-8 text-sm font-sans">
          Generate advertised nowcasts, inspect PNG and NPY artifacts, and review research architecture without fabricated operational claims.
        </p>
        <button
          onClick={onEnterWorkstation}
          className="px-8 py-4 bg-[#56a3a6] hover:bg-[#87d3d6] text-[#003738] font-bold text-sm uppercase tracking-wider inline-flex items-center space-x-2 shadow-lg"
        >
          <span className="material-symbols-outlined" style={{ marginRight: "6px" }}>file_download_done</span>
          <span>ENTER WORKSTATION</span>
        </button>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 bg-[#001017] border-t border-[#3f4949] text-center font-mono text-xs text-[#889393]">
        VajraVIEW Severe Weather Intelligence Platform &copy; 2026. All Rights Reserved.
      </footer>
    </div>
  );
}
