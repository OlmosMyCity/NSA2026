"""FastAPI microservice for Signal vs. Noise multi-hazard biodosimetry attribution."""

import hashlib
import math
import os
import secrets
from pathlib import Path
from typing import Dict
import joblib
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from schemas import (
    AttributionBreakdown,
    BiodosimetryInput,
    BiodosimetryResponse,
    EngineTriageRequest,
    PrimaryCause,
    ShieldingType,
)
from train_model import MODEL_PATH, extract_features, train_and_save

STORM_SCALE_MAP: Dict[str, int] = {
    "S0_NOMINAL": 0,
    "S1_MINOR": 1,
    "S2_MODERATE": 2,
    "S3_STRONG": 3,
    "S4_SEVERE": 4,
    "S5_EXTREME": 5,
}

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


def _verify_model_checksum(model_path: Path) -> None:
    expected = os.getenv("MODEL_SHA256", "").strip().lower()
    if not expected:
        sha_file = Path(f"{model_path}.sha256")
        if not sha_file.exists():
            raise RuntimeError("Model integrity manifest (.sha256) is missing")
        tokens = sha_file.read_text(encoding="utf-8").strip().split()
        if not tokens:
            raise RuntimeError("Model integrity manifest is empty")
        expected = tokens[0].lower()

    actual = hashlib.sha256(model_path.read_bytes()).hexdigest().lower()
    if not secrets.compare_digest(actual, expected):
        raise RuntimeError("Model artifact checksum verification failed")


app = FastAPI(
    title="Artemis IV Signal vs. Noise Biodosimetry Engine",
    version="0.1.0",
    description="Separates ionizing space radiation damage from microgravity and sleep/psych stress.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Service-Token"],
)

_model_bundle = None


def get_model_bundle():
    global _model_bundle
    if _model_bundle is None:
        if not MODEL_PATH.exists():
            train_and_save()
        _verify_model_checksum(MODEL_PATH)
        _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def build_guidance(
    primary: PrimaryCause,
    payload: BiodosimetryInput,
    false_positive_filtered: bool,
) -> tuple[list[str], str]:
    if primary == PrimaryCause.IONIZING_RADIATION:
        guidance = [
            "Evacuate immediately to STORM_SHELTER if currently in EVA_SUIT or unshielded module.",
            "Initiate oral radioprotector protocol (N-acetylcysteine, Vitamins C & E).",
            "Schedule follow-up lymphocyte gamma-H2AX and urinary 8-OHdG assay in 2-4 hours to track DNA repair kinetics.",
        ]
        explanation = (
            f"Genotoxic radiation signature confirmed (gamma-H2AX={payload.gammaH2axFociPerCell:.1f} foci/cell, "
            f"FDXR={payload.fdxrFoldChange:.1f}x, dose={payload.doseRateMicroSvPerHour:.1f} uSv/h)."
        )
    elif primary == PrimaryCause.SLEEP_PSYCH_STRESS:
        guidance = [
            "No acute radiation shelter evacuation required based on current physical dosimetry.",
            "Prioritize 7-8h circadian sleep recovery and light-therapy schedule.",
            "Re-evaluate mood and resting heart rate after rest cycle; repeat urinary 8-OHdG in 12 hours.",
        ]
        if false_positive_filtered:
            explanation = (
                f"False positive filtered: elevated oxidative stress (8-OHdG={payload.urine8OhdgNgMg:.1f} ng/mg) "
                f"aligns with sleep deprivation ({payload.sleepHours:.1f}h) and low mood ({payload.mood}/5), "
                "without DSB/FDXR radiation markers."
            )
        else:
            explanation = (
                f"Physiological stress pattern detected (sleep={payload.sleepHours:.1f}h, mood={payload.mood}/5) "
                "with baseline radiation telemetry."
            )
    elif primary == PrimaryCause.MICROGRAVITY_STRESS:
        guidance = [
            "No acute radiation protocol needed; oxidative stress is consistent with microgravity fluid shift.",
            "Execute ARED/cardiovascular countermeasure session and maintain hydration.",
            "Monitor resting blood pressure and orthostatic tolerance on next routine check.",
        ]
        if false_positive_filtered:
            explanation = (
                f"False positive filtered: elevated 8-OHdG ({payload.urine8OhdgNgMg:.1f} ng/mg) and cardiovascular "
                f"load (BP {payload.systolicMmHg:.0f}/{payload.diastolicMmHg:.0f} mmHg) reflect microgravity "
                "adaptation rather than ionizing radiation."
            )
        else:
            explanation = (
                "Cardiovascular and oxidative markers reflect microgravity fluid-shift adaptation."
            )
    else:
        guidance = [
            "All vitals, physical dosimetry, and molecular biomarkers remain within nominal mission limits.",
            "Continue standard mission health routine.",
        ]
        explanation = "Nominal physiological and radiobiological status."

    return guidance, explanation


def run_attribution(payload: BiodosimetryInput) -> BiodosimetryResponse:
    bundle = get_model_bundle()
    pipeline = bundle["pipeline"]
    classes = list(pipeline.classes_)

    features = extract_features(payload.model_dump()).reshape(1, -1)
    probs = pipeline.predict_proba(features)[0]
    prob_map = {cls: float(p) for cls, p in zip(classes, probs)}

    best_cls = max(prob_map, key=prob_map.get)
    primary = PrimaryCause(best_cls)
    confidence = round(prob_map[best_cls], 4)

    oxidative_stress = payload.urine8OhdgNgMg >= 20.0
    false_positive_filtered = (
        oxidative_stress
        and primary != PrimaryCause.IONIZING_RADIATION
        and prob_map.get(PrimaryCause.IONIZING_RADIATION.value, 0.0) < 0.25
    )

    guidance, explanation = build_guidance(primary, payload, false_positive_filtered)

    return BiodosimetryResponse(
        primaryCause=primary,
        confidence=confidence,
        falsePositiveFiltered=false_positive_filtered,
        oxidativeStressDetected=oxidative_stress,
        attribution=AttributionBreakdown(
            nominalPct=round(prob_map.get(PrimaryCause.NOMINAL.value, 0.0) * 100.0, 1),
            ionizingRadiationPct=round(
                prob_map.get(PrimaryCause.IONIZING_RADIATION.value, 0.0) * 100.0, 1
            ),
            microgravityStressPct=round(
                prob_map.get(PrimaryCause.MICROGRAVITY_STRESS.value, 0.0) * 100.0, 1
            ),
            sleepPsychStressPct=round(
                prob_map.get(PrimaryCause.SLEEP_PSYCH_STRESS.value, 0.0) * 100.0, 1
            ),
        ),
        clinicalGuidance=guidance,
        explanation=explanation,
    )


@app.get("/api/biodosimetry/health")
def health():
    bundle = get_model_bundle()
    return {"status": "ok", "modelLoaded": bundle is not None, "classes": bundle["classes"]}


def _parse_finite_float(mapping: dict, key: str, default: float) -> float:
    try:
        val = float(mapping.get(key, default))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid numeric field: {key}") from exc
    if not math.isfinite(val):
        raise HTTPException(status_code=422, detail=f"Field must be finite: {key}")
    return val


@app.post(
    "/api/biodosimetry/attribution",
    response_model=BiodosimetryResponse,
    dependencies=[Depends(_require_service_token)],
)
def predict_attribution(payload: BiodosimetryInput):
    return run_attribution(payload)


@app.post(
    "/api/biodosimetry/triage-from-engine",
    response_model=BiodosimetryResponse,
    dependencies=[Depends(_require_service_token)],
)
def triage_from_engine(req: EngineTriageRequest):
    """Bridge endpoint accepting raw HealthReading + NSA2026/radiation-engine state."""
    bio_doses = req.radiationState.get("biologicalDoses", {})
    if not isinstance(bio_doses, dict):
        raise HTTPException(status_code=422, detail="radiationState.biologicalDoses must be an object")
    shield_data = bio_doses.get(req.shieldingType.value, {})
    if not isinstance(shield_data, dict):
        shield_data = {}
    dose_rate = _parse_finite_float(shield_data, "doseRateMicroSvPerHour", 25.0)

    telemetry = req.radiationState.get("currentTelemetry", {})
    if not isinstance(telemetry, dict):
        telemetry = {}
    storm_str = telemetry.get("stormScale", "S0_NOMINAL")
    storm_level = STORM_SCALE_MAP.get(storm_str if isinstance(storm_str, str) else "S0_NOMINAL", 0)

    hr = req.healthReading
    try:
        mood = int(hr.get("mood", 4))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid integer field: mood") from exc

    try:
        combined = BiodosimetryInput(
            doseRateMicroSvPerHour=dose_rate,
            stormScaleLevel=storm_level,
            shieldingType=req.shieldingType,
            heartRateBpm=_parse_finite_float(hr, "heartRateBpm", 72.0),
            systolicMmHg=_parse_finite_float(hr, "systolicMmHg", 118.0),
            diastolicMmHg=_parse_finite_float(hr, "diastolicMmHg", 76.0),
            glucoseMgDl=_parse_finite_float(hr, "glucoseMgDl", 95.0),
            temperatureC=_parse_finite_float(hr, "temperatureC", 36.8),
            spo2Pct=_parse_finite_float(hr, "spo2Pct", 98.0),
            sleepHours=_parse_finite_float(hr, "sleepHours", 7.5),
            mood=mood,
            gammaH2axFociPerCell=_parse_finite_float(hr, "gammaH2axFociPerCell", 0.8),
            urine8OhdgNgMg=_parse_finite_float(hr, "urine8OhdgNgMg", 12.0),
            fdxrFoldChange=_parse_finite_float(hr, "fdxrFoldChange", 1.0),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid physiological or dosimetry telemetry range") from exc
    return run_attribution(combined)
