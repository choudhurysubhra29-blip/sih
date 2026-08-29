import React, { useEffect, useState } from "react";
import { get } from "../api";
import { Panel, StatusPill } from "../components/Shared";

export default function Maintenance({ cid }) {
  const [rows, setRows] = useState(null);
  const [scope, setScope] = useState("this");
  useEffect(() => {
    setRows(null);
    get(scope === "this" ? `/maintenance?conveyor_id=${cid}` : "/maintenance").then(setRows);
  }, [cid, scope]);
  if (!rows) return <div className="loading">Loading maintenance history…</div>;
  const completed = rows.filter((r) => r.status === "completed");
  const scheduled = rows.filter((r) => r.status !== "completed");
  const avgGain = completed.length ? (completed.reduce((a, r) => a + (r.health_after - r.health_before), 0) / completed.length).toFixed(1) : 0;
  return (
    <div className="stack" data-testid="maintenance-page">
      <div className="kpi-row kpi-row-3">
        <Panel className="kpi"><label>Completed interventions</label><div className="kpi-line"><div className="value value-lg"><strong>{completed.length}</strong></div></div></Panel>
        <Panel className="kpi"><label>Avg health recovered</label><div className="kpi-line"><div className="value value-lg"><strong>+{avgGain}</strong><span>pts</span></div></div></Panel>
        <Panel className="kpi"><label>Open work orders</label><div className="kpi-line"><div className="value value-lg"><strong>{scheduled.length}</strong></div></div></Panel>
      </div>
      <Panel title="Maintenance history" sub="Each intervention and how it changed belt health"
        right={
          <div className="seg" data-testid="maintenance-scope-toggle">
            <button className={scope === "this" ? "on" : ""} onClick={() => setScope("this")} data-testid="scope-this-button">{cid} only</button>
            <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")} data-testid="scope-all-button">All conveyors</button>
          </div>
        } testid="maintenance-history-panel">
        {completed.length === 0 && <div className="muted small">No completed records for this scope.</div>}
        {completed.map((r) => {
          const gain = Math.round((r.health_after - r.health_before) * 10) / 10;
          return (
            <div className="mnt-row" key={r.id} data-testid={`maintenance-${r.id}`}>
              <div className="mnt-when mono"><b>{r.date}</b><small>{r.conveyor_id}</small></div>
              <div className="mnt-body">
                <strong>{r.type}</strong>
                <p>{r.description}</p>
                <small className="muted">{r.technician} · {r.duration_h} h duration</small>
              </div>
              <div className="mnt-impact">
                <label>Health impact</label>
                <div className="impact-bar">
                  <span className="mono muted">{r.health_before}</span>
                  <div className="track"><i className="s-healthy" style={{ width: `${Math.min(100, gain * 4)}%` }} /></div>
                  <span className="mono">{r.health_after}</span>
                </div>
                <b className="pos mono" data-testid={`impact-${r.id}`}>+{gain} pts</b>
              </div>
            </div>
          );
        })}
      </Panel>
      <Panel title="Open work orders" sub="Raised from dashboard and planner" testid="open-wo-panel">
        {scheduled.length === 0 && <div className="muted small" data-testid="no-open-wo">No open work orders. Raise one from AI Inspection or Prediction.</div>}
        {scheduled.map((r) => (
          <div className="mnt-row" key={r.id} data-testid={`wo-${r.id}`}>
            <div className="mnt-when mono"><b>{r.date}</b><small>{r.conveyor_id}</small></div>
            <div className="mnt-body"><strong>{r.type}</strong><p>{r.description}</p><small className="muted">{r.technician}</small></div>
            <StatusPill status="attention">scheduled</StatusPill>
          </div>
        ))}
      </Panel>
    </div>
  );
}
