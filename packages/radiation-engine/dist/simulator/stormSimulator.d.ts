/**
 * @module simulator/stormSimulator
 * Deterministic solar storm and cislunar radiation scenario simulator.
 *
 * Generates synthetic GOES X-ray/proton telemetry and L1 solar wind conditions across preset
 * mission scenarios (`NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, `SIDE_MISS_CME`) as
 * well as custom Stonyhurst heliographic flare/CME events, feeding the physics, impact,
 * dosimetry, and mitigation engines identically to live telemetry.
 */
import { RadiationEngineState } from '../types';
/** Supported preset space-weather simulation scenarios. */
export type SimulationScenarioId = 'NOMINAL' | 'FLARE_EARLY_WARNING' | 'PEAK_STORM_S4' | 'SIDE_MISS_CME';
/** Parameters for simulating a custom solar eruption and cislunar transit geometry. */
export interface CustomSimulationParams {
    sourceLocation: string;
    flareClass?: 'C' | 'M' | 'X';
    cmeSpeedKmS?: number;
    halfAngleDeg?: number;
    solarWindSpeedKmS?: number;
    densityPcm3?: number;
    bzNt?: number;
    moonPhaseAngleDeg?: number;
}
/**
 * Produces complete, physically consistent `RadiationEngineState` snapshots for preset
 * and custom solar storm scenarios.
 */
export declare class StormSimulator {
    private doseCalculator;
    private sepEngine;
    private impactPredictor;
    private mitigationEngine;
    /**
     * Generates a complete radiation engine state snapshot for the selected preset scenario.
     *
     * @param scenarioId - Preset scenario identifier (`NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, or `SIDE_MISS_CME`).
     * @returns Complete simulated `RadiationEngineState` with `isSimulated: true`.
     */
    getSimulatedState(scenarioId: SimulationScenarioId): RadiationEngineState;
    /**
     * Simulates a custom solar flare/CME event originating from a Stonyhurst heliographic coordinate
     * (e.g., `"N15W45"` or `"S20E70"`), evaluating cislunar impact trajectory, proton flux escalation,
     * biological shielding doses, and mitigation posture.
     *
     * @param params - Custom heliographic source, flare class, CME/solar wind kinematics, and lunar phase.
     * @returns Complete simulated `RadiationEngineState` for the custom eruption.
     */
    simulateCustomEvent(params: CustomSimulationParams): RadiationEngineState;
    private getProbabilitiesForStorm;
    private getProbabilitiesNominal;
}
