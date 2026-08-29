import React from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { post, usePoll } from "../api";
import { Panel, StatusPill, Value } from "../components/Shared";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

const chartTip = { background: "#1f2226", border: "1px solid #33383f", borderRadius: 3, color: "#dde1e6", fontSize: 12 };

export default function Prediction({ cid }) {
  const { data } = usePoll(`/conveyors/${cid}/prediction`, 6000, [cid]);
  if (!data) return <div className="loading">Loading prediction model output…</div>;
  const { conveyor: c, projection, risk_windows, maintenance_window: mw, critical_threshold } = data;
  const reserve = () =>
    post("/maintenance", { conveyor_id: cid, type: "Reserved maintenance window", description: `${mw.duration_h} h window ${mw.start} – ${mw.end}, reserved from prediction view.` })
      .then(() => toast.success("Maintenance window reserved."))
      .catch(() => toast.error("Could not reserve window."));
  return (
    <div className="stack" data-testid="prediction-page">
      <div className="kpi-row kpi-row-3">
        <Panel className="kpi"><label>Current health</label><div className="kpi-line"><Value v={c.health} unit="/100" /><StatusPill status={c.status} /></div></Panel>
        <Panel className="kpi"><label>Predicted remaining life</label><div className="kpi-line"><Value v={Math.round(c.rul_hours)} unit="hrs" /><span className="muted">≈ {(c.rul_hours / 24).toFixed(1)} days to threshold</span></div></Panel>
        <Panel className="kpi"><label>Model confidence</label><div className="kpi-line"><Value v={data.model_confidence} unit="%" /><span className="muted">LSTM survival model v1.9</span></div></Panel>
      </div>
      <Panel title="Projected health trajectory" sub={`Degradation model · critical threshold ${critical_threshold}`} testid="projection-panel">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#26292e" vertical={false} />
              <XAxis dataKey="hours" stroke="#5d6570" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(h) => `${h}h`} />
              <YAxis domain={[30, 100]} stroke="#5d6570" tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip contentStyle={chartTip} labelFormatter={(h) => `+${h} hours`} />
              <ReferenceLine y={critical_threshold} stroke="#e5484d" strokeDasharray="5 4" label={{ value: "CRITICAL", fill: "#e5484d", fontSize: 10, position: "insideBottomLeft" }} />
              <Line type="monotone" dataKey="score" stroke="#aeb6bf" strokeWidth={1.8} dot={{ r: 2.5, fill: "#aeb6bf" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="cols cols-2-1">
        <Panel title="Failure probability windows" sub="Cumulative risk of reaching critical" testid="risk-panel">
          {risk_windows.map((w) => (
            <div className="risk-row" key={w.window} data-testid={`risk-${w.window.replaceAll(" ", "-")}`}>
              <span>{w.window}</span>
              <div className="track"><i className={`s-${w.level === "low" ? "healthy" : w.level === "moderate" ? "attention" : "critical"}`} style={{ width: `${w.risk}%` }} /></div>
              <StatusPill status={w.level === "low" ? "healthy" : w.level === "moderate" ? "attention" : "critical"}>{w.level}</StatusPill>
              <b className="mono">{w.risk}%</b>
            </div>
          ))}
        </Panel>
        <Panel title="Best intervention window" sub="Planner recommendation" testid="window-panel">
          <p className="muted">Reserve a planned <b>{mw.duration_h}-hour</b> window between <b>{mw.start}</b> and <b>{mw.end}</b>, before failure risk accelerates.</p>
          <button className="btn primary" onClick={reserve} data-testid="reserve-window-button"><Wrench size={14} /> Reserve window</button>
        </Panel>
      </div>
    </div>
  );
}
