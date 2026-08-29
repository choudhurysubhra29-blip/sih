import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePoll } from "../api";
import { LiveCamera, MiniSpark, Panel, StatusPill, Value } from "../components/Shared";
import { AlertTriangle, ArrowRight, Wrench } from "lucide-react";
import { toast } from "sonner";
import { post } from "../api";

const chartTip = { background: "#1f2226", border: "1px solid #33383f", borderRadius: 3, color: "#dde1e6", fontSize: 12 };

export default function Overview({ cid, setTab }) {
  const { data } = usePoll(`/conveyors/${cid}/live`, 3000, [cid]);
  if (!data) return <div className="loading" data-testid="overview-loading">Connecting to telemetry stream…</div>;
  const { conveyor: c, sensors, trend, alerts, events, analysis, detections_count } = data;

  const raiseWO = () =>
    post("/maintenance", { conveyor_id: cid, type: "Inspection — operator raised", description: "Raised from live overview." })
      .then(() => toast.success("Work order created and queued for planning."))
      .catch(() => toast.error("Could not create work order."));

  return (
    <div className="stack" data-testid="overview-page">
      <div className="kpi-row">
        <Panel className="kpi" testid="kpi-health">
          <label>Belt health index</label>
          <div className="kpi-line">
            <Value v={c.health} unit="/100" />
            <StatusPill status={c.status} />
          </div>
          <div className="track"><i className={`s-${c.status}`} style={{ width: `${c.health}%` }} /></div>
          <button className="link" onClick={() => setTab("health")} data-testid="health-details-button">Why this score <ArrowRight size={13} /></button>
        </Panel>
        <Panel className="kpi" testid="kpi-rul">
          <label>Remaining useful life</label>
          <div className="kpi-line"><Value v={Math.round(c.rul_hours)} unit="hrs" /><span className="muted">≈ {(c.rul_hours / 24).toFixed(1)} days</span></div>
          <div className="muted small">Model confidence high · updated live</div>
          <button className="link" onClick={() => setTab("prediction")} data-testid="rul-details-button">View prediction <ArrowRight size={13} /></button>
        </Panel>
        <Panel className="kpi" testid="kpi-alerts">
          <label>Active alerts</label>
          <div className="kpi-line"><Value v={alerts.length} /><span className="muted">{detections_count} AI detections on record</span></div>
          {alerts[0] ? <div className={`alert-inline s-${alerts[0].severity}`}><AlertTriangle size={13} /> {alerts[0].title}</div> : <div className="muted small">No active alerts</div>}
          <button className="link" onClick={() => setTab("inspection")} data-testid="alert-review-button">Review detections <ArrowRight size={13} /></button>
        </Panel>
        <Panel className="kpi" testid="kpi-load">
          <label>Load / belt speed</label>
          <div className="kpi-line"><Value v={c.load_tph.toLocaleString()} unit="t/h" /></div>
          <div className="muted small">{c.belt_speed} m/s · {c.length_m.toLocaleString()} m span · {c.area}</div>
        </Panel>
      </div>

      <div className="cols cols-cam">
        <Panel title="Live belt camera" sub={`${c.id} · vision inspection stream`} right={<StatusPill status="healthy" testid="stream-status">Streaming</StatusPill>} testid="camera-panel">
          <LiveCamera conveyor={c} analysis={analysis} camera={`CAM-${c.id.slice(-2)}A`} />
        </Panel>
        <Panel title="Live analysis" sub="On-edge inference · real time" testid="analysis-panel">
          <div className="ana-rows">
            <div className="ana-row"><span>Model</span><b data-testid="analysis-model">{analysis.model}</b></div>
            <div className="ana-row"><span>Frame rate</span><b>{analysis.fps} fps</b></div>
            <div className="ana-row"><span>Inference latency</span><b>{analysis.inference_ms} ms</b></div>
            <div className="ana-row"><span>Frames analysed</span><b data-testid="frames-analysed">{analysis.frames_total.toLocaleString()}</b></div>
            <div className="ana-row"><span>Objects tracked</span><b>{analysis.objects_tracked}</b></div>
          </div>
          <label className="block-label">Class confidence</label>
          {analysis.classes.map((k) => (
            <div className="conf" key={k.name} data-testid={`class-${k.name}`}>
              <span>{k.name}</span>
              <div className="track"><i className="s-neutral" style={{ width: `${k.confidence * 100}%` }} /></div>
              <b>{(k.confidence * 100).toFixed(0)}%</b>
            </div>
          ))}
        </Panel>
      </div>

      <div className="cols cols-2-1">
        <Panel title="Live sensor telemetry" sub="Polled from edge gateway every 3 s" right={<span className="muted small live-tag"><i className="blink" /> LIVE</span>} testid="telemetry-panel">
          <div className="sensor-grid">
            {sensors.map((s) => (
              <div className={`sensor s-b-${s.status}`} key={s.key} data-testid={`sensor-card-${s.key}`}>
                <div className="sensor-top"><span>{s.label}</span><StatusPill status={s.status === "normal" ? "healthy" : s.status}>{s.status.toUpperCase()}</StatusPill></div>
                <div className="sensor-mid">
                  <Value v={s.value} unit={s.unit} size="md" />
                  <MiniSpark points={s.history} status={s.status} />
                </div>
                <div className="sensor-foot">
                  <span>{s.delta > 0 ? "+" : ""}{s.delta} {s.unit} / hr</span>
                  <span>warn ≥ {s.warn}{s.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="chart-strip">
            <label className="block-label">Health index · last 12 h</label>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="hFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9aa3ad" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#9aa3ad" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#26292e" vertical={false} />
                  <XAxis dataKey="t" stroke="#5d6570" tickLine={false} axisLine={false} fontSize={10} minTickGap={40} />
                  <YAxis domain={[40, 100]} stroke="#5d6570" tickLine={false} axisLine={false} fontSize={10} />
                  <Tooltip contentStyle={chartTip} />
                  <Area type="monotone" dataKey="score" stroke="#aeb6bf" strokeWidth={1.6} fill="url(#hFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
        <Panel title="Event log" sub="Most recent first" testid="event-log-panel">
          <div className="timeline">
            {events.map((e, i) => (
              <div className="tl-item" key={i} data-testid={`event-${i}`}>
                <i className={`tl-dot s-${e.level}`} />
                <time>{e.time}</time>
                <div><strong>{e.title}</strong><p>{e.detail}</p></div>
              </div>
            ))}
          </div>
          <button className="link" onClick={() => setTab("reports")} data-testid="timeline-reports-button">Full daily record <ArrowRight size={13} /></button>
        </Panel>
      </div>

      {alerts.length > 0 && (
        <Panel className="reco" testid="recommendation-panel">
          <div className="reco-body">
            <div>
              <label>Recommended action</label>
              <h3>{c.status === "critical" ? "Reduce load and prepare replacement window." : "Continue operation — schedule inspection within 48 hours."}</h3>
              <p className="muted">{alerts[0].detail}</p>
            </div>
            <button className="btn primary" onClick={raiseWO} data-testid="schedule-inspection-button"><Wrench size={14} /> Create work order</button>
          </div>
        </Panel>
      )}
    </div>
  );
}
