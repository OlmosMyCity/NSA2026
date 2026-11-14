"""FastAPI microservice for Plan B: Molecular Twin & ODE Kinetics."""

import json
import os
import secrets
from typing import Optional
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from kinetics_ode import (
    SCENARIOS_CACHE_PATH,
    generate_all_scenarios,
    save_scenarios_cache,
    simulate_kinetics,
)
from molecular_catalog import load_docking_catalog
from schemas import (
    BiophysicsScenarioResponse,
    CustomKineticsRequest,
    DockingComplexEntry,
    ScenarioId,
    ShieldingKineticsResult,
)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://orbvital-nsa2026.vercel.app",
]


def _get_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    parsed = [origin.strip() for origin in raw.split(",") if origin.strip() and origin.strip() != "*"]
    return parsed or DEFAULT_ALLOWED_ORIGINS


def _require_service_token(
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
) -> None:
    expected = os.getenv("AI_SERVICE_TOKEN", "").strip()
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "")).strip().lower()
    if not expected:
        if app_env == "production":
            raise HTTPException(status_code=503, detail="Service authentication is not configured")
        return
    if not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing service token")


app = FastAPI(
    title="Artemis IV Molecular Twin & Biophysics Engine",
    version="0.1.0",
    description=(
        "Serves pre-computed A100 docking evidence (Ku70/Ku80, Keap1/Nrf2) and "
        "real-time/precomputed ODE kinetics (gamma-H2AX & 8-OHdG) for radiation-engine scenarios."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Service-Token"],
)

_scenarios_cache: Optional[dict] = None


def get_scenarios_cache() -> dict:
    global _scenarios_cache
    if _scenarios_cache is None:
        if not SCENARIOS_CACHE_PATH.exists():
            save_scenarios_cache()
        _scenarios_cache = json.loads(SCENARIOS_CACHE_PATH.read_text())
    return _scenarios_cache


@app.get("/api/biophysics/health")
def health() -> dict:
    cache = get_scenarios_cache()
    docking = load_docking_catalog()
    return {
        "status": "ok",
        "scenariosLoaded": list(cache.keys()),
        "dockingComplexesCount": len(docking),
    }


@app.get("/api/biophysics/scenarios/{scenario}", response_model=BiophysicsScenarioResponse)
def get_scenario(scenario: ScenarioId) -> BiophysicsScenarioResponse:
    cache = get_scenarios_cache()
    entry = cache.get(scenario.value)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario.value} not found")

    docking = load_docking_catalog()
    if scenario == ScenarioId.NOMINAL:
        takeaway = (
            "Nominal GCR background: basal NHEJ repair (Ku70/Ku80) handles ~0.6 gamma-H2AX foci/cell "
            "with zero repair saturation. Routine 24h urine 8-OHdG monitoring is sufficient."
        )
    elif scenario == ScenarioId.FLARE_EARLY_WARNING:
        eva_win = entry["shieldingResults"]["EVA_SUIT"]["urineSamplingWindow"]
        takeaway = (
            f"X4.5 Flare Early Warning: moving to STORM_SHELTER before proton arrival cuts peak gamma-H2AX "
            f"by {entry['gammaH2axReductionShelterVsEvaPct']:.1f}%. Begin oral radioprotectors (NAC/Vit C/E) "
            f"now; optimal urine 8-OHdG check window is {eva_win['startHour']:.1f}-{eva_win['endHour']:.1f}h."
        )
    else:
        eva_win = entry["shieldingResults"]["EVA_SUIT"]["urineSamplingWindow"]
        takeaway = (
            f"PEAK_STORM_S4: EVA_SUIT saturates NHEJ DNA repair. STORM_SHELTER reduces dose rate by "
            f"{entry['doseReductionShelterVsEvaPct']:.1f}% and prevents repair saturation. "
            f"Collect urine 8-OHdG between {eva_win['startHour']:.1f}h and {eva_win['endHour']:.1f}h."
        )

    return BiophysicsScenarioResponse(
        scenario=scenario,
        description=entry["description"],
        doseReductionShelterVsEvaPct=entry["doseReductionShelterVsEvaPct"],
        gammaH2axReductionShelterVsEvaPct=entry["gammaH2axReductionShelterVsEvaPct"],
        shieldingResults={
            k: ShieldingKineticsResult(**v) for k, v in entry["shieldingResults"].items()
        },
        dockingEvidence=docking,
        astronautTakeaway=takeaway,
    )


@app.post(
    "/api/biophysics/simulate-kinetics",
    response_model=ShieldingKineticsResult,
    dependencies=[Depends(_require_service_token)],
)
def run_custom_kinetics(req: CustomKineticsRequest) -> ShieldingKineticsResult:
    return simulate_kinetics(
        peak_flux_pfu=req.peakFluxPfu,
        onset_delay_hours=req.onsetDelayHours,
        storm_duration_hours=req.stormDurationHours,
        horizon_hours=req.horizonHours,
        shielding=req.shieldingType,
    )


@app.get("/api/biophysics/docking", response_model=list[DockingComplexEntry])
def list_docking(category: Optional[str] = None) -> list[DockingComplexEntry]:
    return load_docking_catalog(category=category)
