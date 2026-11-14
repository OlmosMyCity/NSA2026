import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
from kinetics_ode import simulate_kinetics
from schemas import ShieldingType

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/biophysics/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert set(body["scenariosLoaded"]) == {
        "NOMINAL",
        "FLARE_EARLY_WARNING",
        "PEAK_STORM_S4",
    }
    assert body["dockingComplexesCount"] >= 5


def test_peak_storm_s4_shelter_reduction_and_saturation():
    res = client.get("/api/biophysics/scenarios/PEAK_STORM_S4")
    assert res.status_code == 200
    data = res.json()

    assert data["doseReductionShelterVsEvaPct"] >= 90.0
    assert data["gammaH2axReductionShelterVsEvaPct"] >= 90.0

    eva = data["shieldingResults"]["EVA_SUIT"]
    shelter = data["shieldingResults"]["STORM_SHELTER"]

    assert eva["isRepairSaturated"] is True
    assert shelter["isRepairSaturated"] is False
    assert eva["peakGammaH2axFoci"] > shelter["peakGammaH2axFoci"] * 5.0


def test_compartmental_lag_tissue_blood_urine():
    result = simulate_kinetics(
        peak_flux_pfu=14500.0,
        onset_delay_hours=0.0,
        storm_duration_hours=10.0,
        horizon_hours=24.0,
        shielding=ShieldingType.EVA_SUIT,
    )
    curve = result.curve
    t_peak_tissue = max(curve, key=lambda p: p.tissueDamage).timeHours
    t_peak_blood = max(curve, key=lambda p: p.blood8Ohdg).timeHours
    t_peak_urine = max(curve, key=lambda p: p.urine8OhdgNgMg).timeHours

    assert t_peak_tissue < t_peak_blood < t_peak_urine
    assert result.urineSamplingWindow.startHour <= t_peak_urine <= result.urineSamplingWindow.endHour


def test_custom_kinetics_endpoint():
    res = client.post(
        "/api/biophysics/simulate-kinetics",
        json={
            "peakFluxPfu": 8000.0,
            "onsetDelayHours": 1.0,
            "stormDurationHours": 8.0,
            "horizonHours": 24.0,
            "shieldingType": "CREW_CABIN_NOMINAL",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["shieldingType"] == "CREW_CABIN_NOMINAL"
    assert len(body["curve"]) > 10
    assert body["peakGammaH2axFoci"] > 1.0


def test_docking_catalog_endpoint():
    res = client.get("/api/biophysics/docking?category=RADIOPROTECTOR_COUNTERMEASURE")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 3
    assert all(item["bindingAffinityKcalMol"] < 0 for item in items)


def test_simulate_kinetics_requires_service_token_when_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "biophysics-secret")
    payload = {
        "peakFluxPfu": 8000.0,
        "onsetDelayHours": 1.0,
        "stormDurationHours": 8.0,
        "horizonHours": 24.0,
        "shieldingType": "CREW_CABIN_NOMINAL",
    }
    res_unauth = client.post("/api/biophysics/simulate-kinetics", json=payload)
    assert res_unauth.status_code == 401

    res_auth = client.post(
        "/api/biophysics/simulate-kinetics",
        json=payload,
        headers={"X-Service-Token": "biophysics-secret"},
    )
    assert res_auth.status_code == 200


def test_cors_blocks_disallowed_origin():
    res = client.options(
        "/api/biophysics/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in {k.lower(): v for k, v in res.headers.items()}
