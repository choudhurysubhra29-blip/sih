import React, { useEffect, useState } from "react";

export const STATUS_LABEL = { healthy: "Healthy", attention: "Attention", warning: "Warning", critical: "Critical", normal: "Normal", low: "Low", moderate: "Moderate", high: "High" };

export function StatusPill({ status = "healthy", children, testid }) {
  return (
    <span className={`pill s-${status}`} data-testid={testid || `pill-${status}`}>
      <i className="pill-dot" /> {children || STATUS_LABEL[status] || status}
    </span>
  );
}

export function Panel({ title, sub, right, children, className = "", testid }) {
  return (
    <section className={`panel ${className}`} data-testid={testid}>
      {(title || right) && (
        <header className="panel-head">
          <div>
            <h2>{title}</h2>
            {sub && <span className="panel-sub">{sub}</span>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function MiniSpark({ points = [], status = "normal", width = 92, height = 26 }) {
  if (!points.length) return null;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const d = points
    .map((p, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - 3 - ((p - min) / span) * (height - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className={`spark s-${status}`} aria-hidden="true">
      <polyline points={d} fill="none" strokeWidth="1.5" />
    </svg>
  );
}

export function Value({ v, unit, size = "lg" }) {
  return (
    <div className={`value value-${size}`}>
      <strong>{v}</strong>
      {unit && <span>{unit}</span>}
    </div>
  );
}

const BOXES = [
  { label: "belt_surface", conf: 0.98, x: 8, y: 30, w: 84, h: 46, cls: "ok" },
  { label: "material_flow", conf: 0.93, x: 24, y: 40, w: 38, h: 30, cls: "ok" },
  { label: "splice_joint", conf: 0.81, x: 60, y: 34, w: 20, h: 22, cls: "watch" },
];

export function LiveCamera({ conveyor, analysis, src = "/media/belt_cam.mp4", camera = "CAM-A", height = 380 }) {
  const [jit, setJit] = useState(0);
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t1 = setInterval(() => setJit((j) => j + 1), 1600);
    const t2 = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);
  const jitter = (i, axis) => ((Math.sin(jit * 1.3 + i * 2.1 + (axis === "y" ? 1 : 0)) * 1.6));
  return (
    <div className="cam" style={{ height }} data-testid="live-camera">
      <video src={src} poster="/media/frame_a.jpg" autoPlay muted loop playsInline />
      <div className="cam-vignette" />
      <div className="cam-grid" />
      {BOXES.map((b, i) => (
        <div key={b.label} className={`bbox bbox-${b.cls}`}
          style={{ left: `${b.x + jitter(i, "x")}%`, top: `${b.y + jitter(i, "y")}%`, width: `${b.w}%`, height: `${b.h}%` }}>
          <span>{b.label} {(b.conf + Math.sin(jit + i) * 0.008).toFixed(2)}</span>
        </div>
      ))}
      <div className="cam-top">
        <span className="cam-id">{camera} · {conveyor?.name?.toUpperCase() || ""}</span>
        <span className="cam-rec"><i /> LIVE {clock.toLocaleTimeString([], { hour12: false })}</span>
      </div>
      <div className="cam-bottom">
        <span>{analysis?.model || "YOLOv8s-belt"}</span>
        <span>{analysis?.fps ?? "--"} FPS</span>
        <span>INF {analysis?.inference_ms ?? "--"} ms</span>
        <span>TRK {analysis?.objects_tracked ?? "--"} OBJ</span>
        <span className="cam-ok">STREAM OK</span>
      </div>
      <i className="corner c-tl" /><i className="corner c-tr" /><i className="corner c-bl" /><i className="corner c-br" />
    </div>
  );
}
