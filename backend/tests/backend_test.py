"""Backend API tests for NMDC Smart Conveyor dashboard."""
import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
CIDS = ["CV-01", "CV-02", "CV-03", "CV-04"]


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------------------------------------------------------- /api/plant
class TestPlant:
    def test_plant_structure(self, api):
        r = api.get(f"{BASE_URL}/api/plant", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "site" in d and "updated" in d
        assert [c["id"] for c in d["conveyors"]] == CIDS
        for c in d["conveyors"]:
            assert "_id" not in c
            assert 0 < c["health"] <= 100
            assert c["status"] in ("healthy", "attention", "warning", "critical")
            assert c["rul_hours"] > 0
            assert c["load_tph"] > 0
            assert isinstance(c["alerts"], int)
        k = d["kpis"]
        for key in ("avg_health", "active_alerts", "total_tph", "running"):
            assert key in k
        assert k["running"] == 4
        assert k["active_alerts"] == sum(c["alerts"] for c in d["conveyors"])

    def test_alerts_endpoint_sorted(self, api):
        r = api.get(f"{BASE_URL}/api/alerts", timeout=30)
        assert r.status_code == 200
        alerts = r.json()
        assert len(alerts) >= 4
        assert alerts[0]["severity"] == "critical"
        for a in alerts:
            assert {"id", "conveyor_id", "severity", "title", "detail", "time"} <= set(a)


# ---------------------------------------------------------------- /live
class TestLive:
    def test_live_structure(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/CV-02/live", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["conveyor"]["id"] == "CV-02"
        keys = [s["key"] for s in d["sensors"]]
        assert set(keys) == {"vibration", "temperature", "tension", "alignment"}
        for s in d["sensors"]:
            assert len(s["history"]) == 20
            assert s["status"] in ("normal", "warning", "critical")
            assert s["unit"] and s["label"]
            assert s["warn"] < s["crit"]
        assert len(d["contributions"]) == 5
        assert len(d["trend"]) == 48
        assert isinstance(d["alerts"], list) and len(d["alerts"]) >= 1
        assert len(d["events"]) >= 1
        assert d["detections_count"] == 3
        a = d["analysis"]
        assert a["model"] and a["fps"] > 0 and a["inference_ms"] > 0
        assert a["frames_total"] > 0
        assert len(a["classes"]) == 4

    def test_live_values_change(self, api):
        r1 = api.get(f"{BASE_URL}/api/conveyors/CV-02/live", timeout=30).json()
        time.sleep(4.5)
        r2 = api.get(f"{BASE_URL}/api/conveyors/CV-02/live", timeout=30).json()
        v1 = {s["key"]: s["value"] for s in r1["sensors"]}
        v2 = {s["key"]: s["value"] for s in r2["sensors"]}
        assert v1 != v2, f"sensor values static: {v1}"
        assert r2["analysis"]["frames_total"] > r1["analysis"]["frames_total"]

    def test_live_unknown_404(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/CV-99/live", timeout=30)
        assert r.status_code == 404

    @pytest.mark.parametrize("cid,expected", [("CV-01", "healthy"), ("CV-04", "critical")])
    def test_status_mapping(self, api, cid, expected):
        d = api.get(f"{BASE_URL}/api/conveyors/{cid}/live", timeout=30).json()
        assert d["conveyor"]["status"] == expected, d["conveyor"]


# ---------------------------------------------------------------- detections
class TestDetections:
    def test_cv02_detections(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/CV-02/detections", timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) == 3
        for d in docs:
            assert "_id" not in d and d["id"]
            assert d["conveyor_id"] == "CV-02"
            assert set(d["box"]) == {"x", "y", "w", "h"}
            assert d["image"].startswith("/media/")
            assert 0 < d["confidence"] <= 100

    def test_cv04_critical_rip(self, api):
        docs = api.get(f"{BASE_URL}/api/conveyors/CV-04/detections", timeout=30).json()
        assert len(docs) == 2
        crit = [d for d in docs if d["severity"] == "critical"]
        assert len(crit) == 1
        assert crit[0]["type"] == "Longitudinal rip"

    def test_unknown_conveyor_detections_empty(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/CV-99/detections", timeout=30)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert r.json() == []


# ---------------------------------------------------------------- prediction
class TestPrediction:
    def test_prediction_structure(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/CV-02/prediction", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["conveyor"]["id"] == "CV-02"
        assert len(d["projection"]) == 8
        assert d["projection"][0]["hours"] == 0
        assert d["critical_threshold"] == 55
        assert len(d["risk_windows"]) == 4
        assert [w["window"] for w in d["risk_windows"]] == ["24 hours", "48 hours", "72 hours", "7 days"]
        for w in d["risk_windows"]:
            assert 0 <= w["risk"] <= 97
            assert w["level"] in ("low", "moderate", "high")
        mw = d["maintenance_window"]
        assert mw["start"] and mw["end"] and mw["duration_h"] == 18
        assert 80 <= d["model_confidence"] <= 100

    def test_prediction_404(self, api):
        r = api.get(f"{BASE_URL}/api/conveyors/NOPE/prediction", timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------- reports
class TestReports:
    def test_reports_list(self, api):
        r = api.get(f"{BASE_URL}/api/reports", params={"conveyor_id": "CV-02"}, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) == 14
        assert docs[0]["date"] > docs[-1]["date"]  # sorted desc
        for d in docs:
            assert "_id" not in d and d["id"]
            assert d["conveyor_id"] == "CV-02"
            for f in ("health_avg", "health_min", "alerts", "rul_hours", "downtime_h", "throughput_kt", "detections"):
                assert f in d

    def test_compare_daily(self, api):
        r = api.get(f"{BASE_URL}/api/reports/compare", params={"conveyor_id": "CV-02", "mode": "daily"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["mode"] == "daily"
        assert d["a"]["label"] and d["b"]["label"]
        assert d["a"]["label"] != d["b"]["label"]
        assert len(d["series"]) == 14
        assert "health_avg" in d["deltas"]
        assert round(d["deltas"]["health_avg"], 1) == round(d["b"]["health_avg"] - d["a"]["health_avg"], 1)
        assert isinstance(d["insight"], str) and len(d["insight"]) > 10

    def test_compare_weekly(self, api):
        r = api.get(f"{BASE_URL}/api/reports/compare", params={"conveyor_id": "CV-02", "mode": "weekly"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "weekly"
        assert d["a"]["label"].startswith("Week of") and d["b"]["label"].startswith("Week of")
        # CV-02 degrades -0.75/day => week B should be lower than week A
        assert d["b"]["health_avg"] < d["a"]["health_avg"]
        assert "degrad" in d["insight"].lower()

    def test_compare_unknown_conveyor(self, api):
        r = api.get(f"{BASE_URL}/api/reports/compare", params={"conveyor_id": "CV-99"}, timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------- maintenance
class TestMaintenance:
    created = []

    def test_maintenance_list(self, api):
        r = api.get(f"{BASE_URL}/api/maintenance", params={"conveyor_id": "CV-02"}, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        completed = [d for d in docs if d["status"] == "completed"]
        assert len(completed) >= 2
        for d in completed:
            assert "_id" not in d and d["id"]
            assert d["health_after"] > d["health_before"]
            assert d["technician"] and d["type"]

    def test_maintenance_all(self, api):
        docs = api.get(f"{BASE_URL}/api/maintenance", timeout=30).json()
        assert len({d["conveyor_id"] for d in docs}) == 4

    def test_create_work_order_and_verify(self, api):
        payload = {"conveyor_id": "CV-02", "type": "TEST_WO", "description": "test"}
        r = api.post(f"{BASE_URL}/api/maintenance", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        doc = r.json()
        assert "_id" not in doc and doc["id"]
        assert doc["status"] == "scheduled"
        assert doc["type"] == "TEST_WO"
        assert doc["health_after"] is None
        assert doc["health_before"] > 0
        TestMaintenance.created.append(doc["id"])

        docs = api.get(f"{BASE_URL}/api/maintenance", params={"conveyor_id": "CV-02"}, timeout=30).json()
        assert doc["id"] in [d["id"] for d in docs]

    def test_create_work_order_unknown_conveyor(self, api):
        r = api.post(f"{BASE_URL}/api/maintenance", json={"conveyor_id": "CV-99", "type": "x"}, timeout=30)
        assert r.status_code == 404

    def test_create_work_order_validation(self, api):
        r = api.post(f"{BASE_URL}/api/maintenance", json={"type": "x"}, timeout=30)
        assert r.status_code == 422


# ---------------------------------------------------------------- static media
class TestMedia:
    @pytest.mark.parametrize("path", ["/media/frame_a.jpg", "/media/belt_cam.mp4"])
    def test_media_assets_served(self, api, path):
        r = api.get(f"{BASE_URL}{path}", timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
