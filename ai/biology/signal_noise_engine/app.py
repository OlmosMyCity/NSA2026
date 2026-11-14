"""FastAPI microservice for Signal vs. Noise multi-hazard biodosimetry attribution."""

from pathlib import Path
from typing import Dict
import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(
    title="Artemis IV Signal vs. Noise Biodosimetry Engine",
    version="0.1.0",
    description="Separates ionizing space radiation damage from microgravity and sleep/psych stress.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model_bundle = None


def get_model_bundle():
    global _model_bundle
    if _model_bundle is None:
        if not MODEL_PATH.exists():
            train_and_save()
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


@app.post("/api/biodosimetry/attribution", response_model=BiodosimetryResponse)
def predict_attribution(payload: BiodosimetryInput):
    return run_attribution(payload)


@app.post("/api/biodosimetry/triage-from-engine", response_model=BiodosimetryResponse)
def triage_from_engine(req: EngineTriageRequest):
    """Bridge endpoint accepting raw HealthReading + NSA2026/radiation-engine state."""
    bio_doses = req.radiationState.get("biologicalDoses", {})
    shield_data = bio_doses.get(req.shieldingType.value, {})
    dose_rate = float(shield_data.get("doseRateMicroSvPerHour", 25.0))

    telemetry = req.radiationState.get("currentTelemetry", {})
    storm_str = telemetry.get("stormScale", "S0_NOMINAL")
    storm_level = STORM_SCALE_MAP.get(storm_str, 0)

    hr = req.healthReading
    combined = BiodosimetryInput(
        doseRateMicroSvPerHour=dose_rate,
        stormScaleLevel=storm_level,
        shieldingType=req.shieldingType,
        heartRateBpm=float(hr.get("heartRateBpm", 72.0)),
        systolicMmHg=float(hr.get("systolicMmHg", 118.0)),
        diastolicMmHg=float(hr.get("diastolicMmHg", 76.0)),
        glucoseMgDl=float(hr.get("glucoseMgDl", 95.0)),
        temperatureC=float(hr.get("temperatureC", 36.8)),
        spo2Pct=float(hr.get("spo2Pct", 98.0)),
        sleepHours=float(hr.get("sleepHours", 7.5)),
        mood=int(hr.get("mood", 4)),
        gammaH2axFociPerCell=float(hr.get("gammaH2axFociPerCell", 0.8)),
        urine8OhdgNgMg=float(hr.get("urine8OhdgNgMg", 12.0)),
        fdxrFoldChange=float(hr.get("fdxrFoldChange", 1.0)),
    )
    return run_attribution(combined)
