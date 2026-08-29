import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  Activity, Bell, ChevronDown, Clock3, Cpu, FileText, LayoutDashboard, Map,
  Menu, Settings as SettingsIcon, ShieldCheck, Wrench, X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { usePoll } from "./api";
import { StatusPill } from "./components/Shared";
import Overview from "./pages/Overview";
import Plant from "./pages/Plant";
import Health from "./pages/Health";
import Inspection from "./pages/Inspection";
import Prediction from "./pages/Prediction";
import Reports from "./pages/Reports";
import Maintenance from "./pages/Maintenance";
import Settings from "./pages/Settings";

const NAV = [
  ["plant", "Plant Overview", Map],
  ["overview", "Live Monitor", LayoutDashboard],
  ["health", "Belt Health", ShieldCheck],
  ["inspection", "AI Inspection", Cpu],
  ["prediction", "Prediction", Clock3],
  ["reports", "Reports", FileText],
  ["maintenance", "Maintenance", Wrench],
  ["settings", "Settings", SettingsIcon],
];

const TITLES = {
  plant: ["Plant Overview", "All conveyors · live"],
  overview: ["Live Monitor", "Operator console"],
  health: ["Belt Health", "Score explainability"],
  inspection: ["AI Inspection", "Vision detections"],
  prediction: ["Prediction", "Remaining useful life"],
  reports: ["Reports", "Daily records & comparison"],
  maintenance: ["Maintenance", "Work history & impact"],
  settings: ["Settings", "System configuration"],
};

export default function App() {
  const [tab, setTab] = useState("overview");
  const [cid, setCid] = useState("CV-02");
  const [menu, setMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const { data: plant } = usePoll("/plant", 10000, []);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const current = useMemo(() => plant?.conveyors?.find((c) => c.id === cid), [plant, cid]);
  const totalAlerts = plant?.kpis?.active_alerts ?? 0;
  const page = TITLES[tab];

  return (
    <div className="shell">
      <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: "#1f2226", border: "1px solid #33383f", color: "#dde1e6" } }} />
      <aside className={`side ${menu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={18} /></div>
          <div><strong>NMDC</strong><span>SMART CONVEYOR</span></div>
          <button className="icon-btn close-menu" onClick={() => setMenu(false)} data-testid="close-menu-button"><X size={16} /></button>
        </div>
        <div className="picker">
          <label>Monitoring</label>
          <button className="picker-btn" onClick={() => setPickerOpen(!pickerOpen)} data-testid="conveyor-selector">
            <b>{cid}</b>
            <span>{current?.name || "—"}</span>
            <ChevronDown size={14} />
          </button>
          {pickerOpen && plant && (
            <div className="picker-list" data-testid="conveyor-picker-list">
              {plant.conveyors.map((c) => (
                <button key={c.id} className={c.id === cid ? "on" : ""} onClick={() => { setCid(c.id); setPickerOpen(false); }} data-testid={`pick-${c.id}`}>
                  <i className={`dot s-${c.status}`} /><b>{c.id}</b><span>{c.name}</span><em className="mono">{c.health}</em>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMenu(false); }} data-testid={`nav-${id}`}>
              <Icon size={15} /><span>{label}</span>
              {id === "plant" && totalAlerts > 0 && <i className="nav-badge">{totalAlerts}</i>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <StatusPill status="healthy" testid="system-status">System online</StatusPill>
          <small>PS26008 · console v2.0</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} data-testid="open-menu-button"><Menu size={18} /></button>
          <div>
            <div className="crumb">{page[0]} <span>/ {page[1]}</span></div>
            <div className="top-title">
              {tab === "plant" ? (plant?.site || "Plant 02") : `Conveyor ${cid} — ${current?.name || ""}`}
              {tab !== "plant" && current && <StatusPill status={current.status} testid="topbar-status" />}
            </div>
          </div>
          <div className="top-actions">
            <div className="clock mono">
              <span>{clock.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span>
              <b>{clock.toLocaleTimeString([], { hour12: false })}</b>
            </div>
            <button className="icon-btn bell" onClick={() => setTab("plant")} data-testid="notifications-button">
              <Bell size={15} />{totalAlerts > 0 && <i>{totalAlerts}</i>}
            </button>
            <div className="operator"><span>RS</span><div><b>R. Sharma</b><small>Shift B · Operator</small></div></div>
          </div>
        </header>
        <div className="content">
          {tab === "plant" && <Plant setCid={setCid} setTab={setTab} />}
          {tab === "overview" && <Overview cid={cid} setTab={setTab} />}
          {tab === "health" && <Health cid={cid} />}
          {tab === "inspection" && <Inspection cid={cid} />}
          {tab === "prediction" && <Prediction cid={cid} />}
          {tab === "reports" && <Reports cid={cid} />}
          {tab === "maintenance" && <Maintenance cid={cid} />}
          {tab === "settings" && <Settings cid={cid} />}
        </div>
      </main>
    </div>
  );
}
