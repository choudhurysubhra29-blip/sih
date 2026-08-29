import React, { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { get } from "../api";
import { Panel } from "../components/Shared";
import { Download } from "lucide-react";
import { toast } from "sonner";

const chartTip = { background: "#1f2226", border: "1px solid #33383f", borderRadius: 3, color: "#dde1e6", fontSize: 12 };

function Delta({ v, invert = false, suffix = "" }) {
  const good = invert ? v > 0 : v < 0 ? false : true;
  const cls = v === 0 ? "muted" : (invert ? v > 0 : v >= 0) ? "pos" : "neg";
  return <b className={`mono delta ${cls}`}>{v > 0 ? "+" : ""}{v}{suffix}</b>;
}

export default function Reports({ cid }) {
  const [rows, setRows] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [mode, setMode] = useState("daily");
  useEffect(() => { setRows(null); get(`/reports?conveyor_id=${cid}`).then(setRows); }, [cid]);
  useEffect(() => { setCmp(null); get(`/reports/compare?conveyor_id=${cid}&mode=${mode}`).then(setCmp); }, [cid, mode]);
  if (!rows) return <div className="loading">Loading report archive…</div>;

  const METRICS = [
    ["health_avg", "Avg health", "", true],
    ["health_min", "Min health", "", true],
    ["alerts", "Alerts", "", false],
    ["detections", "AI detections", "", false],
    ["downtime_h", "Downtime", " h", false],
    ["throughput_kt", "Throughput", " kt", true],
  ];

  return (
    <div className="stack" data-testid="reports-page">
      <Panel title="Period comparison" sub="Spot gradual belt degradation between periods"
        right={
          <div className="seg" data-testid="compare-mode-toggle">
            <button className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")} data-testid="compare-daily-button">Day vs day</button>
            <button className={mode === "weekly" ? "on" : ""} onClick={() => setMode("weekly")} data-testid="compare-weekly-button">Week vs week</button>
          </div>
        } testid="comparison-panel">
        {!cmp ? <div className="loading">Computing comparison…</div> : (
          <>
            <div className="cmp-grid">
              <div className="cmp-col head"><span /> {METRICS.map(([k, l]) => <span key={k}>{l}</span>)}</div>
              <div className="cmp-col"><b className="cmp-label">{cmp.a.label}</b>{METRICS.map(([k, , sfx]) => <span className="mono" key={k}>{cmp.a[k]}{sfx}</span>)}</div>
              <div className="cmp-col"><b className="cmp-label">{cmp.b.label}</b>{METRICS.map(([k, , sfx]) => <span className="mono" key={k}>{cmp.b[k]}{sfx}</span>)}</div>
              <div className="cmp-col"><b className="cmp-label">Δ change</b>{METRICS.map(([k, , sfx, invert]) => <Delta key={k} v={cmp.deltas[k]} invert={invert} suffix={sfx} data-testid={`delta-${k}`} />)}</div>
            </div>
            <div className={`note ${cmp.deltas.health_avg < -1.5 ? "note-warn" : ""}`} data-testid="comparison-insight">{cmp.insight}</div>
            <label className="block-label">14-day health trend</label>
            <div style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cmp.series} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#26292e" vertical={false} />
                  <XAxis dataKey="date" stroke="#5d6570" tickLine={false} axisLine={false} fontSize={10} minTickGap={30} />
                  <YAxis domain={[30, 100]} stroke="#5d6570" tickLine={false} axisLine={false} fontSize={10} />
                  <Tooltip contentStyle={chartTip} />
                  <Line type="monotone" dataKey="health" stroke="#aeb6bf" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Daily report archive" sub={`${rows.length} reports · ${cid}`}
        right={<button className="btn ghost" onClick={() => toast.success("Report bundle prepared for download.")} data-testid="export-reports-button"><Download size={13} /> Export bundle</button>}
        testid="archive-panel">
        <div className="table report-table">
          <div className="tr th"><span>Date</span><span>Avg health</span><span>Min</span><span>Alerts</span><span>Detections</span><span>RUL</span><span>Downtime</span><span>Throughput</span><span /></div>
          {rows.map((r, i) => (
            <div className="tr" key={r.id} data-testid={`report-row-${i}`}>
              <span className="mono"><b>{r.date}</b></span>
              <span className="mono">{r.health_avg}</span>
              <span className="mono muted">{r.health_min}</span>
              <span className="mono">{r.alerts}</span>
              <span className="mono">{r.detections}</span>
              <span className="mono">{r.rul_hours} h</span>
              <span className="mono">{r.downtime_h} h</span>
              <span className="mono">{r.throughput_kt} kt</span>
              <button className="icon-btn" onClick={() => toast.success(`${r.date} report downloaded.`)} data-testid={`download-report-${i}`}><Download size={13} /></button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
