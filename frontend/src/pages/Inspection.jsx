import React, { useEffect, useState } from "react";
import { get, post } from "../api";
import { Panel, StatusPill } from "../components/Shared";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

export default function Inspection({ cid }) {
  const [items, setItems] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    setItems(null);
    get(`/conveyors/${cid}/detections`).then((d) => { setItems(d); setSel(d[0] || null); });
  }, [cid]);
  if (!items) return <div className="loading">Loading detections…</div>;

  const createWO = () =>
    post("/maintenance", { conveyor_id: cid, type: `${sel.type} repair`, description: `${sel.sector} — raised from AI inspection (${sel.confidence}% confidence).` })
      .then(() => toast.success(`Work order created for ${sel.sector.split("·")[0].trim()}.`))
      .catch(() => toast.error("Could not create work order."));

  return (
    <div className="stack" data-testid="inspection-page">
      <div className="cols cols-1-2">
        <Panel title="Detections on record" sub={`${items.length} findings · ${cid}`} testid="detection-list-panel">
          {items.length === 0 && <div className="muted small">No AI detections recorded for this conveyor.</div>}
          {items.map((d) => (
            <button key={d.id} className={`det-row ${sel?.id === d.id ? "selected" : ""}`} onClick={() => setSel(d)}
              data-testid={`detection-${d.id}`}>
              <div className="det-thumb" style={{ backgroundImage: `url(${d.image})` }} />
              <div><strong>{d.type}</strong><p>{d.sector}</p><small className="mono muted">{d.camera} · {d.time}</small></div>
              <StatusPill status={d.severity === "critical" ? "critical" : d.severity === "moderate" ? "warning" : "attention"}>{d.severity}</StatusPill>
            </button>
          ))}
        </Panel>
        {sel && (
          <Panel title={`${sel.type} — annotated frame`} sub={`${sel.camera} · captured ${sel.time}`} right={<span className="mono muted small">conf {sel.confidence}%</span>} testid="detection-detail-panel">
            <div className="det-frame" data-testid="detection-frame">
              <img src={sel.image} alt={sel.type} />
              <div className={`bbox bbox-${sel.severity === "low" ? "watch" : "bad"}`}
                style={{ left: `${sel.box.x}%`, top: `${sel.box.y}%`, width: `${sel.box.w}%`, height: `${sel.box.h}%` }}>
                <span>{sel.type.toLowerCase().replaceAll(" ", "_")} {(sel.confidence / 100).toFixed(2)}</span>
              </div>
              <div className="cam-top"><span className="cam-id">{sel.camera} · STILL FRAME</span><span className="mono muted small">{sel.sector}</span></div>
              <i className="corner c-tl" /><i className="corner c-tr" /><i className="corner c-bl" /><i className="corner c-br" />
            </div>
            <div className="det-meta">
              <div>
                <label>Model note</label>
                <p>{sel.note}</p>
              </div>
              <button className="btn primary" onClick={createWO} data-testid="inspection-work-order-button"><Wrench size={14} /> Create work order</button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
