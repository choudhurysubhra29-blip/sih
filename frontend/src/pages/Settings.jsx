import React, { useState } from "react";
import { Panel } from "../components/Shared";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings({ cid }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="stack" data-testid="settings-page">
      <div className="cols cols-2">
        <Panel title="Conveyor profile" sub={cid} testid="profile-panel">
          <label className="field">Conveyor name<input defaultValue={`Conveyor ${cid}`} data-testid="conveyor-name-input" /></label>
          <label className="field">Plant location<input defaultValue="NMDC Bacheli Complex · Plant 02" data-testid="plant-location-input" /></label>
          <label className="field">Telemetry refresh interval
            <select defaultValue="3 seconds" data-testid="refresh-interval-select">
              <option>3 seconds</option><option>10 seconds</option><option>30 seconds</option>
            </select>
          </label>
        </Panel>
        <Panel title="Alert thresholds" sub="Applies to this operator console" testid="thresholds-panel">
          <label className="field">Critical health score<input type="number" defaultValue="55" data-testid="critical-score-input" /></label>
          <label className="field">RUL maintenance trigger<input defaultValue="48 hours" data-testid="rul-trigger-input" /></label>
          <div className="toggle-row">
            <span><b>Sound alerts</b><small className="muted">Play a sound for new critical events</small></span>
            <button className="toggle on" data-testid="sound-alert-toggle" onClick={(e) => e.currentTarget.classList.toggle("on")}><i /></button>
          </div>
        </Panel>
      </div>
      <div className="row-end">
        <button className="btn primary" onClick={() => { setSaved(true); toast.success("Configuration saved."); }} data-testid="save-settings-button"><Check size={14} /> Save changes</button>
      </div>
      {saved && <div className="saved-banner" data-testid="settings-saved-message"><CheckCircle2 size={14} /> Configuration saved for this browser session.</div>}
    </div>
  );
}
