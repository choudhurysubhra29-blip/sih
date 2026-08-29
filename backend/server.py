import asyncio
import math
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="NMDC Smart Conveyor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- simulation

PROFILES = {
    "CV-01": {
        "name": "Primary Crusher Feed", "area": "Crushing Plant", "length_m": 850,
        "base": {"vibration": 1.7, "temperature": 41.5, "tension": 62.0, "alignment": 2.0},
        "health": 93.0, "rul": 412.0, "speed": 3.2, "load": 1850, "vision_penalty": 0,
    },
    "CV-02": {
        "name": "Screening Transfer", "area": "Screening Station", "length_m": 1420,
        "base": {"vibration": 2.6, "temperature": 48.0, "tension": 71.0, "alignment": 4.1},
        "health": 84.0, "rul": 147.0, "speed": 4.0, "load": 2400, "vision_penalty": 5,
    },
    "CV-03": {
        "name": "Stockpile Feed", "area": "Stockyard North", "length_m": 980,
        "base": {"vibration": 3.4, "temperature": 55.5, "tension": 78.0, "alignment": 6.3},
        "health": 68.0, "rul": 64.0, "speed": 3.6, "load": 2100, "vision_penalty": 9,
    },
    "CV-04": {
        "name": "Ship Loadout", "area": "Loadout Terminal", "length_m": 1210,
        "base": {"vibration": 4.6, "temperature": 63.0, "tension": 87.0, "alignment": 9.2},
        "health": 49.0, "rul": 21.0, "speed": 2.1, "load": 1200, "vision_penalty": 16,
    },
}

SENSOR_META = {
    "vibration": {"label": "Vibration RMS", "unit": "mm/s", "warn": 3.5, "crit": 5.0},
    "temperature": {"label": "Bearing Temp", "unit": "\u00b0C", "warn": 60.0, "crit": 75.0},
    "tension": {"label": "Belt Tension", "unit": "%", "warn": 82.0, "crit": 92.0},
    "alignment": {"label": "Tracking Offset", "unit": "mm", "warn": 7.0, "crit": 12.0},
}

STATE = {}


def status_of(health):
    if health >= 85:
        return "healthy"
    if health >= 70:
        return "attention"
    if health >= 55:
        return "warning"
    return "critical"


def sensor_status(key, value):
    m = SENSOR_META[key]
    if value >= m["crit"]:
        return "critical"
    if value >= m["warn"]:
        return "warning"
    return "normal"


def init_state():
    now = datetime.now(timezone.utc)
    for cid, p in PROFILES.items():
        sensors = {k: v for k, v in p["base"].items()}
        trend = []
        h = p["health"]
        for i in range(48):
            trend.append({
                "t": (now - timedelta(minutes=15 * (48 - i))).strftime("%H:%M"),
                "score": round(min(100, max(5, h + random.uniform(-1.6, 2.2) + (48 - i) * 0.05)), 1),
            })
        hist = {k: [round(v + random.uniform(-0.08, 0.08) * max(v, 1), 2) for _ in range(20)] for k, v in sensors.items()}
        STATE[cid] = {
            "sensors": sensors, "health": h, "rul": p["rul"], "trend": trend,
            "history": hist, "frames": random.randint(2_400_000, 3_900_000),
            "events": [], "alerts": [],
        }
    seed_events()


def seed_events():
    now = datetime.now(timezone.utc)
    def ts(mins):
        return (now - timedelta(minutes=mins)).strftime("%H:%M")
    STATE["CV-02"]["events"] = [
        {"time": ts(12), "title": "Splice tear detected", "detail": "Vision model \u00b7 92% confidence \u00b7 Joint J-07", "level": "warning"},
        {"time": ts(74), "title": "Vibration deviation cleared", "detail": "Drive pulley returned to baseline", "level": "info"},
        {"time": ts(203), "title": "Vibration anomaly", "detail": "Drive pulley RMS +0.6 mm/s above baseline", "level": "warning"},
        {"time": ts(510), "title": "Shift changeover", "detail": "Shift B \u00b7 Operator R. Sharma", "level": "info"},
    ]
    STATE["CV-02"]["alerts"] = [{
        "id": "al-cv02-1", "conveyor_id": "CV-02", "severity": "attention",
        "title": "Moderate splice tear \u2014 Joint J-07",
        "detail": "Vision detection at 92% confidence. Schedule splice inspection within 48 h.",
        "time": ts(12),
    }]
    STATE["CV-03"]["events"] = [
        {"time": ts(33), "title": "Bearing temperature high", "detail": "Tail pulley bearing 55.8 \u00b0C, trending up", "level": "warning"},
        {"time": ts(160), "title": "Edge fraying detected", "detail": "Vision model \u00b7 86% confidence \u00b7 Return run", "level": "warning"},
        {"time": ts(495), "title": "Shift changeover", "detail": "Shift B \u00b7 Operator A. Kujur", "level": "info"},
    ]
    STATE["CV-03"]["alerts"] = [{
        "id": "al-cv03-1", "conveyor_id": "CV-03", "severity": "warning",
        "title": "Bearing temperature rising \u2014 tail pulley",
        "detail": "Temperature trending toward 60 \u00b0C limit. Verify lubrication.",
        "time": ts(33),
    }]
    STATE["CV-04"]["events"] = [
        {"time": ts(8), "title": "Longitudinal rip growth", "detail": "Rip extended to 210 mm \u00b7 Chute discharge zone", "level": "critical"},
        {"time": ts(51), "title": "Tension excursion", "detail": "Take-up tension exceeded 90% for 4 min", "level": "warning"},
        {"time": ts(120), "title": "Speed reduced to 55%", "detail": "Operator action \u2014 load limited pending repair", "level": "info"},
    ]
    STATE["CV-04"]["alerts"] = [
        {"id": "al-cv04-1", "conveyor_id": "CV-04", "severity": "critical",
         "title": "Longitudinal rip \u2014 discharge zone",
         "detail": "Predicted critical in ~21 h. Belt replacement window required.",
         "time": ts(8)},
        {"id": "al-cv04-2", "conveyor_id": "CV-04", "severity": "warning",
         "title": "Take-up tension excursions",
         "detail": "3 excursions above 90% in last 6 h.",
         "time": ts(51)},
    ]
    STATE["CV-01"]["events"] = [
        {"time": ts(40), "title": "Routine vision sweep complete", "detail": "142 belt segments \u00b7 0 new findings", "level": "info"},
        {"time": ts(500), "title": "Shift changeover", "detail": "Shift B \u00b7 Operator D. Netam", "level": "info"},
    ]


def tick():
    now = datetime.now(timezone.utc)
    for cid, p in PROFILES.items():
        s = STATE[cid]
        for k, base in p["base"].items():
            drift = random.gauss(0, 0.025) * max(base, 1)
            s["sensors"][k] = round(max(0.1, s["sensors"][k] * 0.9 + (base + drift) * 0.1 + random.gauss(0, 0.015) * max(base, 1)), 2)
            s["history"][k] = (s["history"][k] + [s["sensors"][k]])[-20:]
        dev = 0.0
        for k, v in s["sensors"].items():
            m = SENSOR_META[k]
            dev += max(0.0, (v - p["base"][k]) / (m["crit"] - p["base"][k])) * 6
        target = 100 - p["vision_penalty"] - dev - (100 - p["health"]) * 0.92
        s["health"] = round(min(100, max(5, s["health"] * 0.85 + (p["health"] + random.uniform(-0.8, 0.8)) * 0.15)), 1)
        s["rul"] = round(max(1, s["rul"] - random.uniform(0.0, 0.02)), 1)
        s["frames"] += random.randint(60, 90)
        if now.second < 3 or len(s["trend"]) == 0 or s["trend"][-1]["t"] != now.strftime("%H:%M"):
            s["trend"] = (s["trend"] + [{"t": now.strftime("%H:%M"), "score": s["health"]}])[-48:]


async def sim_loop():
    while True:
        tick()
        await asyncio.sleep(3.0)

# ---------------------------------------------------------------- seed data

DETECTIONS = [
    {"_id": "det-cv02-1", "conveyor_id": "CV-02", "type": "Splice tear", "confidence": 92, "severity": "moderate",
     "sector": "Joint J-07 \u00b7 chainage 612 m", "time": "13:42", "camera": "CAM-02A", "image": "/media/frame_a.jpg",
     "box": {"x": 34, "y": 38, "w": 26, "h": 22}, "note": "Tear across splice edge, 140 mm. Monitor growth; schedule splice inspection."},
    {"_id": "det-cv02-2", "conveyor_id": "CV-02", "type": "Edge fraying", "confidence": 88, "severity": "low",
     "sector": "Return run \u00b7 chainage 890 m", "time": "11:15", "camera": "CAM-02B", "image": "/media/frame_b.jpg",
     "box": {"x": 58, "y": 52, "w": 22, "h": 18}, "note": "Frayed edge strands on carry side. Within tolerance, re-check next sweep."},
    {"_id": "det-cv02-3", "conveyor_id": "CV-02", "type": "Surface crack", "confidence": 81, "severity": "low",
     "sector": "Loading zone \u00b7 chainage 105 m", "time": "08:48", "camera": "CAM-02A", "image": "/media/frame_c.jpg",
     "box": {"x": 42, "y": 30, "w": 20, "h": 24}, "note": "Hairline top-cover crack. No cord exposure visible."},
    {"_id": "det-cv03-1", "conveyor_id": "CV-03", "type": "Edge fraying", "confidence": 86, "severity": "moderate",
     "sector": "Return run \u00b7 chainage 412 m", "time": "12:20", "camera": "CAM-03A", "image": "/media/frame_d.jpg",
     "box": {"x": 50, "y": 44, "w": 24, "h": 20}, "note": "Progressive fraying, likely tracking-related. Correlates with 6.3 mm offset."},
    {"_id": "det-cv03-2", "conveyor_id": "CV-03", "type": "Idler damage", "confidence": 79, "severity": "low",
     "sector": "Carry side \u00b7 frame 118", "time": "07:36", "camera": "CAM-03B", "image": "/media/frame_b.jpg",
     "box": {"x": 26, "y": 55, "w": 18, "h": 16}, "note": "Seized idler roller suspected \u2014 acoustic signature match 74%."},
    {"_id": "det-cv04-1", "conveyor_id": "CV-04", "type": "Longitudinal rip", "confidence": 96, "severity": "critical",
     "sector": "Discharge chute \u00b7 chainage 1,180 m", "time": "14:02", "camera": "CAM-04A", "image": "/media/frame_c.jpg",
     "box": {"x": 38, "y": 26, "w": 30, "h": 34}, "note": "Rip length 210 mm and growing. Foreign object damage suspected. Replacement window required."},
    {"_id": "det-cv04-2", "conveyor_id": "CV-04", "type": "Cover wear", "confidence": 84, "severity": "moderate",
     "sector": "Loading zone \u00b7 chainage 60 m", "time": "09:11", "camera": "CAM-04B", "image": "/media/frame_a.jpg",
     "box": {"x": 30, "y": 46, "w": 34, "h": 20}, "note": "Top cover thickness below 40% in impact zone."},
]

MAINTENANCE = [
    {"_id": "mnt-1", "conveyor_id": "CV-02", "date": "2026-08-21", "type": "Splice re-vulcanization",
     "description": "Hot splice repair at Joint J-03 after vision-detected separation.", "technician": "M. Ekka \u00b7 Belt crew A",
     "duration_h": 14, "health_before": 71, "health_after": 89, "status": "completed"},
    {"_id": "mnt-2", "conveyor_id": "CV-02", "date": "2026-07-30", "type": "Idler set replacement",
     "description": "Replaced 12 carry-side idlers, frames 84\u201396, after acoustic anomaly.", "technician": "S. Patel \u00b7 Belt crew B",
     "duration_h": 6, "health_before": 78, "health_after": 85, "status": "completed"},
    {"_id": "mnt-3", "conveyor_id": "CV-03", "date": "2026-08-14", "type": "Belt tracking adjustment",
     "description": "Re-aligned training idlers, reduced offset from 11 mm to 4 mm.", "technician": "A. Kujur \u00b7 Belt crew A",
     "duration_h": 4, "health_before": 63, "health_after": 74, "status": "completed"},
    {"_id": "mnt-4", "conveyor_id": "CV-03", "date": "2026-06-28", "type": "Tail pulley bearing swap",
     "description": "Replaced DE bearing after temperature trend exceeded 65 \u00b0C.", "technician": "R. Sharma \u00b7 Mech crew",
     "duration_h": 9, "health_before": 58, "health_after": 79, "status": "completed"},
    {"_id": "mnt-5", "conveyor_id": "CV-04", "date": "2026-08-09", "type": "Rip panel patch",
     "description": "Cold-bond patch on 90 mm rip, discharge zone. Temporary \u2014 monitored.", "technician": "M. Ekka \u00b7 Belt crew A",
     "duration_h": 8, "health_before": 44, "health_after": 61, "status": "completed"},
    {"_id": "mnt-6", "conveyor_id": "CV-01", "date": "2026-08-02", "type": "Scheduled belt scan + lube",
     "description": "Quarterly preventive maintenance. No defects found.", "technician": "D. Netam \u00b7 Belt crew B",
     "duration_h": 5, "health_before": 91, "health_after": 94, "status": "completed"},
]


def build_reports():
    docs = []
    today = datetime(2026, 8, 29, tzinfo=timezone.utc)
    curves = {"CV-01": (94, -0.10), "CV-02": (95, -0.75), "CV-03": (82, -1.00), "CV-04": (74, -1.80)}
    rng = random.Random(42)
    for cid, (start, slope) in curves.items():
        p = PROFILES[cid]
        for i in range(14):
            d = today - timedelta(days=13 - i)
            avg = max(20, start + slope * i + rng.uniform(-1.5, 1.5))
            alerts = max(0, int((100 - avg) / 12 + rng.uniform(-0.8, 1.2)))
            docs.append({
                "_id": f"rep-{cid}-{d.strftime('%Y-%m-%d')}", "conveyor_id": cid,
                "date": d.strftime("%Y-%m-%d"), "health_avg": round(avg, 1),
                "health_min": round(avg - rng.uniform(2, 6), 1), "alerts": alerts,
                "rul_hours": round(max(10, p["rul"] + (13 - i) * rng.uniform(4, 9))),
                "downtime_h": round(rng.uniform(0, 1.4) if alerts else 0.0, 1),
                "throughput_kt": round(p["load"] * 22 / 1000 * rng.uniform(0.88, 1.02), 1),
                "detections": max(0, alerts - rng.randint(0, 1)),
            })
    return docs


@app.on_event("startup")
async def startup():
    init_state()
    if await db.detections.count_documents({}) == 0:
        await db.detections.insert_many(DETECTIONS)
    if await db.maintenance.count_documents({}) == 0:
        await db.maintenance.insert_many(MAINTENANCE)
    if await db.reports.count_documents({}) == 0:
        await db.reports.insert_many(build_reports())
    asyncio.create_task(sim_loop())

# ---------------------------------------------------------------- endpoints


def conveyor_summary(cid):
    p, s = PROFILES[cid], STATE[cid]
    return {
        "id": cid, "name": p["name"], "area": p["area"], "length_m": p["length_m"],
        "health": s["health"], "status": status_of(s["health"]), "rul_hours": s["rul"],
        "belt_speed": round(p["speed"] + random.uniform(-0.05, 0.05), 2),
        "load_tph": int(p["load"] * random.uniform(0.96, 1.04)),
        "alerts": len(s["alerts"]),
    }


@app.get("/api/plant")
async def plant():
    convs = [conveyor_summary(cid) for cid in PROFILES]
    return {
        "site": "NMDC Bacheli Complex \u00b7 Plant 02",
        "updated": datetime.now(timezone.utc).isoformat(),
        "conveyors": convs,
        "kpis": {
            "avg_health": round(sum(c["health"] for c in convs) / len(convs), 1),
            "active_alerts": sum(c["alerts"] for c in convs),
            "total_tph": sum(c["load_tph"] for c in convs),
            "running": len(convs),
        },
    }


@app.get("/api/alerts")
async def alerts():
    out = []
    for cid in PROFILES:
        out.extend(STATE[cid]["alerts"])
    order = {"critical": 0, "warning": 1, "attention": 2}
    return sorted(out, key=lambda a: order.get(a["severity"], 3))


@app.get("/api/conveyors/{cid}/live")
async def live(cid: str):
    if cid not in PROFILES:
        raise HTTPException(404, "unknown conveyor")
    p, s = PROFILES[cid], STATE[cid]
    sensors = []
    for k, v in s["sensors"].items():
        m = SENSOR_META[k]
        hist = s["history"][k]
        delta = round(hist[-1] - hist[0], 2)
        sensors.append({
            "key": k, "label": m["label"], "value": v, "unit": m["unit"],
            "status": sensor_status(k, v), "delta": delta, "history": hist,
            "warn": m["warn"], "crit": m["crit"],
        })
    contribs = []
    vis = 100 - p["vision_penalty"] * 2
    contribs.append({"name": "Vision / surface", "score": max(20, vis), "impact": -p["vision_penalty"], "status": "warning" if p["vision_penalty"] >= 5 else "normal"})
    weights = {"vibration": 2.2, "temperature": 1.6, "tension": 1.4, "alignment": 1.8}
    for k, v in s["sensors"].items():
        m = SENSOR_META[k]
        ratio = max(0.0, (v - p["base"][k] * 0.9) / (m["crit"] - p["base"][k] * 0.9))
        penalty = round(min(20, ratio * weights[k] * 4), 1)
        contribs.append({
            "name": m["label"], "score": round(max(15, 100 - ratio * 55)),
            "impact": -penalty if penalty >= 0.5 else 0,
            "status": sensor_status(k, v) if sensor_status(k, v) != "critical" else "critical",
        })
    det_count = await db.detections.count_documents({"conveyor_id": cid})
    return {
        "conveyor": conveyor_summary(cid),
        "sensors": sensors,
        "contributions": contribs,
        "trend": s["trend"],
        "alerts": s["alerts"],
        "events": s["events"],
        "detections_count": det_count,
        "analysis": {
            "model": "YOLOv8s-belt v2.3", "fps": round(random.uniform(23.2, 24.8), 1),
            "inference_ms": round(random.uniform(11.5, 16.8), 1),
            "frames_total": s["frames"], "objects_tracked": random.randint(3, 7),
            "classes": [
                {"name": "belt_surface", "confidence": round(random.uniform(0.97, 0.99), 2)},
                {"name": "material_flow", "confidence": round(random.uniform(0.88, 0.95), 2)},
                {"name": "splice_joint", "confidence": round(random.uniform(0.74, 0.86), 2)},
                {"name": "edge_boundary", "confidence": round(random.uniform(0.90, 0.97), 2)},
            ],
        },
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/conveyors/{cid}/detections")
async def detections(cid: str):
    docs = await db.detections.find({"conveyor_id": cid}).to_list(50)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@app.get("/api/conveyors/{cid}/prediction")
async def prediction(cid: str):
    if cid not in PROFILES:
        raise HTTPException(404, "unknown conveyor")
    s = STATE[cid]
    h, rul = s["health"], s["rul"]
    proj, decay = [], (h - 55) / max(rul, 1)
    for i in range(0, 8):
        t = rul * i / 7
        proj.append({"hours": round(t), "score": round(max(30, h - decay * t - 0.002 * t * t), 1)})
    def risk(hours):
        return min(97, round(8 + (hours / max(rul, 1)) * 68 + (100 - h) * 0.35))
    windows = [
        {"window": "24 hours", "risk": risk(24)},
        {"window": "48 hours", "risk": risk(48)},
        {"window": "72 hours", "risk": risk(72)},
        {"window": "7 days", "risk": risk(168)},
    ]
    for w in windows:
        w["level"] = "low" if w["risk"] < 20 else "moderate" if w["risk"] < 45 else "high"
    best_start = datetime.now(timezone.utc) + timedelta(hours=max(6, rul * 0.45))
    return {
        "conveyor": conveyor_summary(cid),
        "model_confidence": round(random.uniform(88.5, 93.5), 1),
        "projection": proj, "critical_threshold": 55, "risk_windows": windows,
        "maintenance_window": {
            "start": best_start.strftime("%d %b %Y"),
            "end": (best_start + timedelta(hours=18)).strftime("%d %b %Y"),
            "duration_h": 18,
        },
    }


@app.get("/api/reports")
async def reports(conveyor_id: str = "CV-02"):
    docs = await db.reports.find({"conveyor_id": conveyor_id}).sort("date", -1).to_list(30)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@app.get("/api/reports/compare")
async def compare(conveyor_id: str = "CV-02", mode: str = "daily"):
    docs = await db.reports.find({"conveyor_id": conveyor_id}).sort("date", 1).to_list(30)
    if not docs:
        raise HTTPException(404, "no reports")
    series = [{"date": d["date"][5:], "health": d["health_avg"], "alerts": d["alerts"]} for d in docs]
    def agg(chunk, label):
        n = len(chunk)
        return {
            "label": label,
            "health_avg": round(sum(r["health_avg"] for r in chunk) / n, 1),
            "health_min": round(min(r["health_min"] for r in chunk), 1),
            "alerts": sum(r["alerts"] for r in chunk),
            "detections": sum(r["detections"] for r in chunk),
            "downtime_h": round(sum(r["downtime_h"] for r in chunk), 1),
            "throughput_kt": round(sum(r["throughput_kt"] for r in chunk), 1),
            "rul_hours": round(sum(r["rul_hours"] for r in chunk) / n),
        }
    if mode == "weekly":
        a, b = agg(docs[:7], f"Week of {docs[0]['date'][5:]}"), agg(docs[7:14], f"Week of {docs[7]['date'][5:]}")
    else:
        a, b = agg([docs[-2]], docs[-2]["date"]), agg([docs[-1]], docs[-1]["date"])
    deltas = {k: round(b[k] - a[k], 1) for k in a if k != "label"}
    degradation = deltas["health_avg"] < -1.5 or deltas["alerts"] > 1
    return {"mode": mode, "a": a, "b": b, "deltas": deltas, "series": series,
            "insight": ("Health is degrading measurably between periods \u2014 review vision detections and plan intervention."
                        if degradation else "No significant degradation between periods. Continue normal monitoring.")}


class WorkOrder(BaseModel):
    conveyor_id: str
    type: str
    description: str = ""


@app.get("/api/maintenance")
async def maintenance(conveyor_id: str | None = None):
    q = {"conveyor_id": conveyor_id} if conveyor_id else {}
    docs = await db.maintenance.find(q).sort("date", -1).to_list(100)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@app.post("/api/maintenance")
async def create_work_order(wo: WorkOrder):
    if wo.conveyor_id not in PROFILES:
        raise HTTPException(404, "unknown conveyor")
    doc = {
        "_id": f"mnt-{uuid.uuid4().hex[:8]}", "conveyor_id": wo.conveyor_id,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "type": wo.type,
        "description": wo.description or "Operator-raised work order from dashboard.",
        "technician": "Unassigned", "duration_h": 0,
        "health_before": STATE[wo.conveyor_id]["health"], "health_after": None,
        "status": "scheduled",
    }
    await db.maintenance.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return doc
