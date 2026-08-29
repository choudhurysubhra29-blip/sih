import React from "react";
import { usePoll } from "../api";
import { Panel, StatusPill, Value } from "../components/Shared";
import { ArrowRight } from "lucide-react";

const NODES = ["Crusher", "Screening", "Stockyard", "Loadout", "Port"];

export default function Plant({ setCid, setTab }) {
  const { data } = usePoll("/plant", 5000, []);
  const { data: alerts } = usePoll("/alerts", 5000, []);
  if (!data) return <div className="loading">Loading plant overview…</div>;
  const open = (id) => { setCid(id); setTab("overview"); };
  return (
    <div className="stack" data-testid="plant-page">
      <div className="kpi-row">
        <Panel className="kpi"><label>Plant average health</label><div className="kpi-line"><Value v={data.kpis.avg_health} unit="/100" /></div></Panel>
        <Panel className="kpi"><label>Active alerts</label><div className="kpi-line"><Value v={data.kpis.active_alerts} /></div></Panel>
        <Panel className="kpi"><label>Combined throughput</label><div className="kpi-line"><Value v={data.kpis.total_tph.toLocaleString()} unit="t/h" /></div></Panel>
        <Panel className="kpi"><label>Conveyors running</label><div className="kpi-line"><Value v={`${data.kpis.running}/4`} /></div></Panel>
      </div>

      <Panel title="Material flow map" sub={data.site} testid="plant-map-panel">
        <div className="flow-map">
          {data.conveyors.map((c, i) => (
            <React.Fragment key={c.id}>
              <div className="flow-node">
                <span>{NODES[i]}</span>
              </div>
              <button className={`flow-line s-b-${c.status}`} onClick={() => open(c.id)} data-testid={`map-conveyor-${c.id}`}>
                <span className="flow-id">{c.id}</span>
                <i className={`flow-belt s-${c.status}`}><em /><em /><em /></i>
                <span className="flow-meta">{c.health}/100 · {c.load_tph.toLocaleString()} t/h</span>
              </button>
            </React.Fragment>
          ))}
          <div className="flow-node"><span>{NODES[4]}</span></div>
        </div>
        <div className="legend">
          {["healthy", "attention", "warning", "critical"].map((s) => (
            <span key={s}><i className={`dot s-${s}`} /> {s}</span>
          ))}
        </div>
      </Panel>

      <div className="cols cols-2-1">
        <Panel title="All conveyors" sub="Live status · refreshed every 5 s" testid="plant-table-panel">
          <div className="table plant-table">
            <div className="tr th"><span>ID</span><span>Name / area</span><span>Health</span><span>Status</span><span>RUL</span><span>Load</span><span>Alerts</span><span /></div>
            {data.conveyors.map((c) => (
              <div className="tr" key={c.id} data-testid={`plant-row-${c.id}`}>
                <span className="mono">{c.id}</span>
                <span><b>{c.name}</b><small>{c.area}</small></span>
                <span className="mono">{c.health}</span>
                <span><StatusPill status={c.status} /></span>
                <span className="mono">{Math.round(c.rul_hours)} h</span>
                <span className="mono">{c.load_tph.toLocaleString()} t/h</span>
                <span className="mono">{c.alerts}</span>
                <button className="link" onClick={() => open(c.id)} data-testid={`open-conveyor-${c.id}`}>Open <ArrowRight size={12} /></button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Plant alert queue" sub="Sorted by severity" testid="plant-alerts-panel">
          {(alerts || []).length === 0 && <div className="muted small">No active alerts.</div>}
          {(alerts || []).map((a) => (
            <div className={`alert-card s-b-${a.severity}`} key={a.id} data-testid={`alert-${a.id}`}>
              <div className="alert-head"><StatusPill status={a.severity} /><span className="mono muted">{a.conveyor_id} · {a.time}</span></div>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
