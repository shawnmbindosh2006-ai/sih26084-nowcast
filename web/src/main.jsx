import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import fixture from "./fixture.json";
import { chooseDefaultMethod, discoverForecastOptions, requestNowcast } from "./contract.js";
import { normalizeDashboardData } from "./dashboardModel.js";
import { LandingPage } from "./LandingPage.jsx";
import { Workstation } from "./Workstation.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function App({ initialBundle = fixture, apiBase = API_BASE, initialView = "workstation" }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [discovery, setDiscovery] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedLead, setSelectedLead] = useState(0);
  const [apiState, setApiState] = useState(apiBase ? "discovering" : "fixture");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState(initialView);

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
          setError(`API discovery failed (${reason.message}). Showing local synthetic fixture.`);
        }
      });
    return () => controller.abort();
  }, [apiBase]);

  function selectMethod(method) {
    if (!discovery?.availablePipelines?.[method]) return;
    const next = discovery.availablePipelines[method];
    setSelectedMethod(method);
    setSelectedEvent(next.event_id);
    setSelectedLead(next.supported_lead_times_minutes[0]);
    setError("");
  }

  async function generateForecast(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!discovery || !selectedMethod) return;
    setApiState("loading");
    setError("");
    try {
      const response = await requestNowcast(apiBase, {
        eventId: selectedEvent,
        leadTimesMinutes: [selectedLead],
        forecastMethod: selectedMethod,
      });
      setBundle(response);
      setApiState("ready");
    } catch (reason) {
      setApiState("fixture");
      setError(reason.message || "Nowcast request failed.");
    }
  }

  const normalized = useMemo(() => {
    try {
      return normalizeDashboardData(bundle);
    } catch {
      return normalizeDashboardData(fixture);
    }
  }, [bundle]);

  if (viewMode === "landing") {
    return <LandingPage onEnterWorkstation={() => setViewMode("workstation")} />;
  }

  return (
    <Workstation
      data={normalized}
      discovery={discovery}
      selectedMethod={selectedMethod}
      selectMethod={selectMethod}
      selectedEvent={selectedEvent}
      setSelectedEvent={setSelectedEvent}
      selectedLead={selectedLead}
      setSelectedLead={setSelectedLead}
      generateForecast={generateForecast}
      apiState={apiState}
      error={error}
      apiBase={apiBase}
      onGoToLanding={() => setViewMode("landing")}
    />
  );
}

if (typeof document !== "undefined") {
  const rootElement = document.getElementById("root");
  if (rootElement && !rootElement.hasChildNodes()) {
    createRoot(rootElement).render(<App />);
  }
}
