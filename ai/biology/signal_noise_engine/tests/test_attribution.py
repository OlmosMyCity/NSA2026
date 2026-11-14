import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
from schemas import PrimaryCause

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/biodosimetry/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["modelLoaded"] is True


def test_filters_sleep_stress_false_positive():
    res = client.post(
        "/api/biodosimetry/attribution",
        json={
            "doseRateMicroSvPerHour": 22.0,
            "stormScaleLevel": 0,
            "shieldingType": "CREW_CABIN_NOMINAL",
            "heartRateBpm": 86,
            "systolicMmHg": 130,
            "diastolicMmHg": 84,
            "glucoseMgDl": 114,
            "temperatureC": 36.8,
            "spo2Pct": 97.5,
            "sleepHours": 3.5,
            "mood": 1,
            "gammaH2axFociPerCell": 0.9,
            "urine8OhdgNgMg": 30.0,
            "fdxrFoldChange": 1.1,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["primaryCause"] == PrimaryCause.SLEEP_PSYCH_STRESS.value
    assert data["oxidativeStressDetected"] is True
    assert data["falsePositiveFiltered"] is True
    assert data["attribution"]["sleepPsychStressPct"] > 50.0


def test_detects_ionizing_radiation_in_eva():
    res = client.post(
        "/api/biodosimetry/attribution",
        json={
            "doseRateMicroSvPerHour": 34439.3,
            "stormScaleLevel": 4,
            "shieldingType": "EVA_SUIT",
            "heartRateBpm": 92,
            "systolicMmHg": 126,
            "diastolicMmHg": 82,
            "glucoseMgDl": 106,
            "temperatureC": 37.3,
            "spo2Pct": 96.5,
            "sleepHours": 6.5,
            "mood": 3,
            "gammaH2axFociPerCell": 9.8,
            "urine8OhdgNgMg": 55.0,
            "fdxrFoldChange": 7.5,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["primaryCause"] == PrimaryCause.IONIZING_RADIATION.value
    assert data["falsePositiveFiltered"] is False
    assert data["attribution"]["ionizingRadiationPct"] > 70.0


def test_detects_microgravity_fluid_shift():
    res = client.post(
        "/api/biodosimetry/attribution",
        json={
            "doseRateMicroSvPerHour": 30.0,
            "stormScaleLevel": 0,
            "shieldingType": "CREW_CABIN_NOMINAL",
            "heartRateBpm": 90,
            "systolicMmHg": 138,
            "diastolicMmHg": 88,
            "glucoseMgDl": 105,
            "temperatureC": 36.9,
            "spo2Pct": 96.0,
            "sleepHours": 7.0,
            "mood": 3,
            "gammaH2axFociPerCell": 1.0,
            "urine8OhdgNgMg": 26.0,
            "fdxrFoldChange": 1.2,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["primaryCause"] == PrimaryCause.MICROGRAVITY_STRESS.value
    assert data["falsePositiveFiltered"] is True


def test_triage_from_radiation_engine_payload():
    res = client.post(
        "/api/biodosimetry/triage-from-engine",
        json={
            "shieldingType": "EVA_SUIT",
            "healthReading": {
                "heartRateBpm": 95,
                "systolicMmHg": 128,
                "diastolicMmHg": 82,
                "glucoseMgDl": 108,
                "temperatureC": 37.4,
                "spo2Pct": 96.5,
                "sleepHours": 6.2,
                "mood": 2,
                "gammaH2axFociPerCell": 11.2,
                "urine8OhdgNgMg": 60.0,
                "fdxrFoldChange": 8.2,
            },
            "radiationState": {
                "currentTelemetry": {"stormScale": "S4_SEVERE"},
                "biologicalDoses": {
                    "EVA_SUIT": {"doseRateMicroSvPerHour": 34439.3},
                    "STORM_SHELTER": {"doseRateMicroSvPerHour": 1451.8},
                },
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["primaryCause"] == PrimaryCause.IONIZING_RADIATION.value
