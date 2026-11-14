"""Biophysical ODE kinetics solver for Plan B (Molecular Twin).

Models two coupled kinetic processes aligned with NSA2026/radiation-engine:
1. Non-linear Michaelis-Menten DNA DSB (gamma-H2AX) induction & NHEJ repair saturation:
       dD/dt = alpha * R_dot(t) + d_endo - (V_max * D) / (K_m + D)
2. Stiff 3-compartmental Tissue -> Blood -> Urine (8-OHdG) pharmacokinetic excretion:
       dT/dt = beta * R_dot(t) + t_endo - k_tb * T
       dB/dt = k_tb * T - k_cl * B
       dU/dt = k_cl * B - k_ex * U
"""

import json
from pathlib import Path
from typing import Dict, Tuple
import numpy as np
from scipy.integrate import solve_ivp

from schemas import (
    KineticsPoint,
    ScenarioId,
    ShieldingKineticsResult,
    ShieldingType,
    UrineSamplingWindow,
)

# Matching NSA2026/radiation-engine/src/physics/doseCalculator.ts
SHIELDING_ATTENUATION: Dict[ShieldingType, float] = {
    ShieldingType.EVA_SUIT: 0.95,
    ShieldingType.CREW_CABIN_NOMINAL: 0.25,
    ShieldingType.STORM_SHELTER: 0.04,
}

BACKGROUND_GCR_MICRO_SV_PER_HOUR = 1.8
PFU_TO_RAW_MICRO_SV_PER_HOUR = 2.5

# Biophysical kinetic constants
# gamma-H2AX foci/cell (Michaelis-Menten repair)
ALPHA_DSB_PER_MSV = 0.28        # foci induced per mSv
ENDOGENOUS_DSB_RATE = 0.17      # foci / h endogenous baseline
V_MAX_REPAIR = 1.35             # max NHEJ repair velocity (foci / h)
K_M_SATURATION = 4.0            # half-saturation constant (foci / cell)

# 8-OHdG compartmental pharmacokinetics (ng/mg creatinine equivalent)
BETA_OXIDATIVE_PER_MSV = 0.42   # tissue oxidative lesion rate per mSv
ENDOGENOUS_TISSUE_RATE = 2.4    # baseline metabolic ROS lesion rate
K_TB_TISSUE_TO_BLOOD = 0.45     # 1 / h
K_CL_BLOOD_TO_URINE = 0.35      # 1 / h
K_EX_URINE_CLEARANCE = 0.20     # 1 / h (renal excretion washout; baseline ~ 12 ng/mg)

DATA_DIR = Path(__file__).parent / "data"
SCENARIOS_CACHE_PATH = DATA_DIR / "kinetics_scenarios.json"

SCENARIO_DEFINITIONS: Dict[ScenarioId, dict] = {
    ScenarioId.NOMINAL: {
        "description": "Quiet interplanetary GCR background (0.2 pfu); basal DNA repair active.",
        "peakFluxPfu": 0.2,
        "onsetDelayHours": 0.0,
        "stormDurationHours": 24.0,
        "horizonHours": 24.0,
    },
    ScenarioId.FLARE_EARLY_WARNING: {
        "description": (
            "X4.5 solar flare detected at t=0; energetic protons arrive at ~48 min (0.8 h) "
            "ramping toward 12,000 pfu."
        ),
        "peakFluxPfu": 12000.0,
        "onsetDelayHours": 0.8,
        "stormDurationHours": 10.0,
        "horizonHours": 24.0,
    },
    ScenarioId.PEAK_STORM_S4: {
        "description": (
            "Severe S4 Solar Particle Event (14,500 pfu peak) active at t=0; "
            "compares unshielded EVA_SUIT vs. STORM_SHELTER."
        ),
        "peakFluxPfu": 14500.0,
        "onsetDelayHours": 0.0,
        "stormDurationHours": 10.0,
        "horizonHours": 24.0,
    },
}


def proton_flux_profile_pfu(
    t_hours: float,
    peak_flux_pfu: float,
    onset_delay_hours: float,
    storm_duration_hours: float,
) -> float:
    """Smooth log-normal-like SPE proton flux profile (pfu) over time."""
    if peak_flux_pfu <= 1.0:
        return peak_flux_pfu

    dt = t_hours - onset_delay_hours
    if dt <= 0.0 or dt >= storm_duration_hours:
        return 0.2

    # Smooth raised-cosine / skewed pulse peaking at 30% of storm duration
    phase = dt / storm_duration_hours
    skewed = np.sin(np.pi * (phase ** 0.65)) ** 2
    return float(0.2 + (peak_flux_pfu - 0.2) * skewed)


def dose_rate_micro_sv_per_hour(flux_pfu: float, shielding: ShieldingType) -> float:
    attenuation = SHIELDING_ATTENUATION[shielding]
    return BACKGROUND_GCR_MICRO_SV_PER_HOUR + flux_pfu * PFU_TO_RAW_MICRO_SV_PER_HOUR * attenuation


def _steady_state_baseline() -> Tuple[float, float, float, float]:
    """Compute nominal GCR steady-state initial conditions [D0, T0, B0, U0]."""
    r_dot_msv = dose_rate_micro_sv_per_hour(0.2, ShieldingType.CREW_CABIN_NOMINAL) / 1000.0
    in_d = ALPHA_DSB_PER_MSV * r_dot_msv + ENDOGENOUS_DSB_RATE
    # in_d = V_max * D0 / (K_m + D0) => D0 = (in_d * K_m) / (V_max - in_d)
    d0 = (in_d * K_M_SATURATION) / max(V_MAX_REPAIR - in_d, 1e-4)

    in_t = BETA_OXIDATIVE_PER_MSV * r_dot_msv + ENDOGENOUS_TISSUE_RATE
    t0 = in_t / K_TB_TISSUE_TO_BLOOD
    b0 = (K_TB_TISSUE_TO_BLOOD * t0) / K_CL_BLOOD_TO_URINE
    u0 = (K_CL_BLOOD_TO_URINE * b0) / K_EX_URINE_CLEARANCE
    return float(d0), float(t0), float(b0), float(u0)


def simulate_kinetics(
    peak_flux_pfu: float,
    onset_delay_hours: float,
    storm_duration_hours: float,
    horizon_hours: float,
    shielding: ShieldingType,
    num_points: int = 97,
) -> ShieldingKineticsResult:
    """Solve coupled gamma-H2AX and 8-OHdG ODEs using scipy.integrate.solve_ivp (BDF)."""
    y0 = _steady_state_baseline()
    t_eval = np.linspace(0.0, horizon_hours, num_points)

    def ode_rhs(t: float, y: np.ndarray) -> list[float]:
        d_foci, tissue, blood, urine = y
        flux = proton_flux_profile_pfu(t, peak_flux_pfu, onset_delay_hours, storm_duration_hours)
        r_dot_msv = dose_rate_micro_sv_per_hour(flux, shielding) / 1000.0

        d_foci_pos = max(d_foci, 0.0)
        dd_dt = (
            ALPHA_DSB_PER_MSV * r_dot_msv
            + ENDOGENOUS_DSB_RATE
            - (V_MAX_REPAIR * d_foci_pos) / (K_M_SATURATION + d_foci_pos)
        )
        dt_dt = BETA_OXIDATIVE_PER_MSV * r_dot_msv + ENDOGENOUS_TISSUE_RATE - K_TB_TISSUE_TO_BLOOD * tissue
        db_dt = K_TB_TISSUE_TO_BLOOD * tissue - K_CL_BLOOD_TO_URINE * blood
        du_dt = K_CL_BLOOD_TO_URINE * blood - K_EX_URINE_CLEARANCE * urine
        return [dd_dt, dt_dt, db_dt, du_dt]

    sol = solve_ivp(
        ode_rhs,
        t_span=(0.0, horizon_hours),
        y0=y0,
        t_eval=t_eval,
        method="BDF",
        rtol=1e-6,
        atol=1e-8,
    )
    if not sol.success:
        raise RuntimeError(f"ODE solver failed: {sol.message}")

    curve: list[KineticsPoint] = []
    for idx, t_val in enumerate(sol.t):
        flux = proton_flux_profile_pfu(float(t_val), peak_flux_pfu, onset_delay_hours, storm_duration_hours)
        dose_rate = dose_rate_micro_sv_per_hour(flux, shielding)
        d_val = max(float(sol.y[0, idx]), 0.0)
        t_dmg = max(float(sol.y[1, idx]), 0.0)
        b_val = max(float(sol.y[2, idx]), 0.0)
        u_val = max(float(sol.y[3, idx]), 0.0)
        sat_ratio = d_val / K_M_SATURATION
        curve.append(
            KineticsPoint(
                timeHours=round(float(t_val), 2),
                doseRateMicroSvPerHour=round(dose_rate, 2),
                gammaH2axFociPerCell=round(d_val, 3),
                repairSaturationRatio=round(sat_ratio, 3),
                tissueDamage=round(t_dmg, 3),
                blood8Ohdg=round(b_val, 3),
                urine8OhdgNgMg=round(u_val, 3),
            )
        )

    peak_dose = max(p.doseRateMicroSvPerHour for p in curve)
    peak_g_point = max(curve, key=lambda p: p.gammaH2axFociPerCell)
    max_sat = max(p.repairSaturationRatio for p in curve)
    is_saturated = max_sat >= 1.0

    # Compute optimal urinary 8-OHdG sampling window (where excess above baseline >= 50% of peak excess)
    baseline_u = y0[3]
    peak_u_point = max(curve, key=lambda p: p.urine8OhdgNgMg)
    excess_peak = peak_u_point.urine8OhdgNgMg - baseline_u

    if excess_peak < 1.0:
        sampling_window = UrineSamplingWindow(
            startHour=0.0,
            peakHour=peak_u_point.timeHours,
            endHour=horizon_hours,
            peakUrine8OhdgNgMg=peak_u_point.urine8OhdgNgMg,
            guidance="Nominal GCR baseline; routine 24h urine check is sufficient.",
        )
    else:
        threshold = baseline_u + 0.5 * excess_peak
        window_pts = [p.timeHours for p in curve if p.urine8OhdgNgMg >= threshold]
        start_h = window_pts[0] if window_pts else peak_u_point.timeHours
        end_h = window_pts[-1] if window_pts else peak_u_point.timeHours
        sampling_window = UrineSamplingWindow(
            startHour=start_h,
            peakHour=peak_u_point.timeHours,
            endHour=end_h,
            peakUrine8OhdgNgMg=peak_u_point.urine8OhdgNgMg,
            guidance=(
                f"Collect urine 8-OHdG sample between {start_h:.1f}h and {end_h:.1f}h "
                f"(peak excretion at {peak_u_point.timeHours:.1f}h)."
            ),
        )

    return ShieldingKineticsResult(
        shieldingType=shielding,
        attenuationFactor=SHIELDING_ATTENUATION[shielding],
        peakDoseRateMicroSvPerHour=round(peak_dose, 2),
        peakGammaH2axFoci=peak_g_point.gammaH2axFociPerCell,
        timeToPeakGammaH2axHours=peak_g_point.timeHours,
        isRepairSaturated=is_saturated,
        maxRepairSaturationRatio=round(max_sat, 3),
        urineSamplingWindow=sampling_window,
        curve=curve,
    )


def generate_all_scenarios() -> Dict[str, dict]:
    """Pre-compute ODE curves for all radiation-engine scenarios across all 3 shieldings."""
    results: Dict[str, dict] = {}
    for scenario_id, cfg in SCENARIO_DEFINITIONS.items():
        shielding_map: Dict[str, ShieldingKineticsResult] = {}
        for shielding in ShieldingType:
            shielding_map[shielding.value] = simulate_kinetics(
                peak_flux_pfu=cfg["peakFluxPfu"],
                onset_delay_hours=cfg["onsetDelayHours"],
                storm_duration_hours=cfg["stormDurationHours"],
                horizon_hours=cfg["horizonHours"],
                shielding=shielding,
            )

        eva = shielding_map[ShieldingType.EVA_SUIT.value]
        shelter = shielding_map[ShieldingType.STORM_SHELTER.value]
        dose_red = (
            100.0 * (eva.peakDoseRateMicroSvPerHour - shelter.peakDoseRateMicroSvPerHour) / eva.peakDoseRateMicroSvPerHour
            if eva.peakDoseRateMicroSvPerHour > 0
            else 0.0
        )
        g_red = (
            100.0 * (eva.peakGammaH2axFoci - shelter.peakGammaH2axFoci) / eva.peakGammaH2axFoci
            if eva.peakGammaH2axFoci > 0
            else 0.0
        )

        results[scenario_id.value] = {
            "scenario": scenario_id.value,
            "description": cfg["description"],
            "doseReductionShelterVsEvaPct": round(dose_red, 2),
            "gammaH2axReductionShelterVsEvaPct": round(g_red, 2),
            "shieldingResults": {k: v.model_dump() for k, v in shielding_map.items()},
        }
    return results


def save_scenarios_cache() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = generate_all_scenarios()
    SCENARIOS_CACHE_PATH.write_text(json.dumps(data, indent=2))
    return SCENARIOS_CACHE_PATH


if __name__ == "__main__":
    out_path = save_scenarios_cache()
    print(f"Saved precomputed ODE kinetics scenarios to {out_path}")
