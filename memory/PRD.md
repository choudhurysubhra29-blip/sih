# NMDC Smart Conveyor Frontend MVP

## Original problem statement
Build a frontend-only, operator-first dark industrial dashboard for NMDC Smart Conveyor based on the PS26008 architecture. It should make conveyor safety, belt health, active issues, predicted critical timing, and maintenance action understandable within 5–10 seconds. The MVP includes Overview/Live Monitor, Belt Health, AI Inspection, Prediction, Reports, and Settings.

## Architecture decisions
- React frontend with a single-page tabbed dashboard and responsive sidebar navigation.
- Recharts for health trend visualization and CSS visuals for the conveyor schematic and RUL projection.
- Realistic local demo data and toast feedback; no backend API connection by design.
- Design direction follows the generated dark industrial clean guidelines: Manrope UI type, DM Mono telemetry type, cyan/green/amber status language, high-contrast panels.

## Implemented
- Operator Overview with health ring (87/100), 147-hour RUL, alert, live sensor cards, event timeline, and recommended action.
- Belt Health page with contribution bars, explainability / “why” panel, insight message, and 24-hour trend chart.
- AI Inspection page with selectable detections, camera-style image overlay, confidence/severity, and work-order feedback.
- Prediction page with health/RUL/risk cards, visual projection, risk windows, and maintenance reservation feedback.
- Reports page with daily archive, export bundle feedback, report downloads, and monthly highlights.
- Settings page with editable demo configuration, thresholds, sound toggle, and saved-session feedback.
- Responsive mobile menu, no horizontal overflow at mobile width, and descriptive unique `data-testid` coverage for user-facing controls.

## Prioritized backlog
- P0: Connect live telemetry, health score, RUL, AI detections, reports, and maintenance actions to backend services.
- P1: Add multi-conveyor plant overview and engineer-level raw sensor drill-down.
- P1: Add real PDF/Excel report generation and maintenance history.
- P2: Add authenticated roles, configurable health thresholds, WebSocket updates, and offline edge buffering.

## Next tasks
- Replace demo state with live FastAPI/MongoDB endpoints when backend integration is requested.
- Add real image uploads and annotated inspection frames.
- Add report comparison and weekly/monthly trend views.