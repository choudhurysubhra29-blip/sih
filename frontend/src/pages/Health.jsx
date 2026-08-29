import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePoll } from "../api";
import { Panel, StatusPill, Value } from "../components/Shared";

const chartTip = { background: "#1f2226", border: "1px solid #33383f", borderRadius: 3, color: "#dde1e6", fontSize: 12 };

export default function Health({ cid }) {
  const { data } = usePoll(`/conveyors/${cid}/live`, 4000, [cid]);
  if (!data) return <div className="loading">Loading health profile…</div>;
  const { conveyor: c, contributions, trend } = data;
  const negatives = contributions.filter((x) => x.impact < 0).sort((a, b) => a.impact - b.impact);
  return (
    <div className="stack" data-testid="health-page">
      <div className="cols cols-2-1">
        <Panel title={`Why is the health index ${c.health}?`} sub="Signal contribution to composite score" testid="contribution-panel">
          <div className="health-head">
            <div className="ring-wrap">
              <div className={`ring s-ring-${c.status}`} style={{ "--pct": `${c.health * 3.6}deg` }}>
                <div><strong data-testid="health-score">{c.health}</strong><span>/100</span></div>
              </div>
              <StatusPill status={c.status} />
            </div>
            <p className="muted">The index combines vision inspection, vibration, temperature, tension and tracking signals. Lower sub-scores mean the signal is further from learned normal operation.</p>
          </div>
          <div className="contribs">
            {contributions.map((x) => (
              <div className="contrib" key={x.name} data-testid={`contribution-${x.name.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`}>
                <div className="contrib-top"><span>{x.name}</span><b className="mono">{x.score}</b></div>
                <div className="track"><i className={`s-${x.status === "normal" ? "neutral" : x.status}`} style={{ width: `${x.score}%` }} /></div>
                <small className={x.impact < 0 ? "neg" : "muted"}>{x.impact < 0 ? `${x.impact} points` : "no penalty"}</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Primary reasons" sub="Ranked by impact" testid="reasons-panel">
          {negatives.length === 0 && <div className="muted small">All signals within learned normal range.</div>}
          {negatives.map((x, i) => (
            <div className="reason" key={x.name} data-testid={`reason-${i}`}>
              <span className="mono muted">{String(i + 1).padStart(2, "0")}</span>
              <div><strong>{x.name}</strong><p className="muted small">Deviation from baseline is reducing the composite score.</p></div>
              <b className="neg mono">{x.impact}</b>
            </div>
          ))}
          <div className="note">
            The largest contributor to the current reduction is <b>{negatives[0]?.name || "—"}</b>. Address it first to recover the most points.
          </div>
        </Panel>
      </div>
      <Panel title="Health index trend" sub="Rolling 12-hour window · live" right={<span className="muted small">Current <b className="mono">{c.health}</b></span>} testid="trend-panel">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="hFill2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9aa3ad" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#9aa3ad" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26292e" vertical={false} />
              <XAxis dataKey="t" stroke="#5d6570" tickLine={false} axisLine={false} fontSize={11} minTickGap={40} />
              <YAxis domain={[30, 100]} stroke="#5d6570" tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip contentStyle={chartTip} />
              <Area type="monotone" dataKey="score" stroke="#aeb6bf" strokeWidth={1.8} fill="url(#hFill2)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
