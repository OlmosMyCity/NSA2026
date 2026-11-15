/**
 * @module physics/sepPrediction
 * Relativistic Solar Energetic Particle (SEP) transit-time and flare early-warning model.
 *
 * Computes relativistic proton velocities (MeV -> beta = v/c), effective interplanetary
 * travel time along the curved Parker spiral (in AU) with pitch-angle scattering, and
 * operational early-warning lead times from GOES soft X-ray precursors (W/m^2).
 */
import { GOESXrayReading, EarlyWarningWindow } from '../types';
/**
 * Predicts SEP proton arrival lead times and NOAA storm severity from GOES X-ray flare telemetry.
 */
export declare class SepPredictionEngine {
    private readonly SPEED_OF_LIGHT;
    private readonly PROTON_REST_MASS_MEV;
    private readonly AU_KM;
    /**
     * Computes the relativistic speed fraction beta = v / c for a proton of kinetic energy E (MeV).
     *
     * Uses the Lorentz factor gamma = 1 + E / (m_p * c^2) and beta = sqrt(1 - 1 / gamma^2).
     *
     * @param energyMev - Proton kinetic energy in MeV.
     * @returns Dimensionless relativistic velocity fraction beta (0 to <1).
     */
    calculateRelativisticBeta(energyMev: number): number;
    /**
     * Computes interplanetary proton transit time along the Parker spiral in minutes.
     *
     * Accounts for curved IMF field-line geometry (~1.2 to 1.3 AU nominal path length from Sun
     * to 1 AU) and interplanetary pitch-angle scattering / diffusion (1.8x to 2.5x effective path
     * delay for peak flux arrival).
     *
     * @param energyMev - Proton kinetic energy in MeV.
     * @param parkerLengthAu - Magnetic field-line path length from Sun to target in AU (default 1.25 AU).
     * @param scatteringFactor - Dimensionless diffusive transport delay multiplier (default 2.0).
     * @returns Estimated proton transit time in minutes.
     */
    calculateTransitTimeMinutes(energyMev: number, parkerLengthAu?: number, scatteringFactor?: number): number;
    /**
     * Evaluates whether a GOES 0.1-0.8 nm X-ray reading triggers an SEP early-warning window.
     *
     * Triggers on major flares (>= M5, flux >= 5e-5 W/m^2) or impulsive M2+ rises
     * (flux >= 2e-5 W/m^2 and dF/dt > 5e-6 W/m^2/min). Available warning lead time equals the
     * 100 MeV proton transit time minus the 8.32-minute electromagnetic X-ray travel time across 1 AU,
     * floored at 20 minutes.
     *
     * @param latestXray - Most recent GOES X-ray reading, or null if unavailable.
     * @returns Early-warning window state, lead time in minutes, and projected NOAA S-scale.
     */
    evaluateEarlyWarning(latestXray: GOESXrayReading | null): EarlyWarningWindow;
}
