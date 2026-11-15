/**
 * @module radiation-engine
 * Public entrypoint for the Deep Space Radiation Prediction Engine.
 *
 * Exports the unified `RadiationEngine` orchestrator along with NOAA SWPC and NASA DONKI
 * telemetry clients, SEP Parker spiral transit physics, cislunar CME impact geometry,
 * NASA-STD-3001 biological dosimetry, NOAA S0-S5 mitigation rules, and the deterministic
 * storm simulator.
 */
import { NoaaSwpcClient, computeSolarWindMetrics } from './clients/noaaSwpcClient';
import { NasaDonkiClient } from './clients/nasaDonkiClient';
import { SepPredictionEngine } from './physics/sepPrediction';
import { SolarWindImpactPredictor } from './physics/solarWindImpact';
import { DoseCalculator } from './physics/doseCalculator';
import { MitigationRulesEngine } from './alert/mitigationRules';
import { StormSimulator, SimulationScenarioId, CustomSimulationParams } from './simulator/stormSimulator';
import { RadiationEngineState } from './types';
export * from './types';
export { NoaaSwpcClient, NasaDonkiClient, SepPredictionEngine, SolarWindImpactPredictor, DoseCalculator, MitigationRulesEngine, StormSimulator, computeSolarWindMetrics };
export type { SimulationScenarioId, CustomSimulationParams };
/**
 * Facade coordinating live NOAA/NASA space-weather telemetry, relativistic SEP prediction,
 * Earth-Moon corridor impact modeling, biological dose calculations, and simulation overrides.
 */
export declare class RadiationEngine {
    private noaaClient;
    private nasaClient;
    private sepEngine;
    private impactPredictor;
    private doseCalculator;
    private mitigationEngine;
    private simulator;
    private activeSimulatedScenario;
    private activeCustomSimulation;
    /**
     * Retrieves the current space-weather and radiation assessment.
     *
     * Returns simulated state when a custom event or preset scenario is active; otherwise queries
     * live NOAA SWPC and NASA DONKI feeds in parallel, applying per-feed nominal fallback and
     * setting `telemetryDegraded` when one or two primary NOAA feeds fail (or falling back to the
     * `'NOMINAL'` baseline if all three primary NOAA SWPC feeds are unavailable).
     *
     * @returns Consolidated `RadiationEngineState` snapshot.
     */
    getCurrentState(): Promise<RadiationEngineState>;
    /**
     * Activates or clears a preset storm simulation scenario (`null` restores live telemetry).
     *
     * @param scenarioId - Preset scenario identifier, or `null` to return to live NOAA/NASA feeds.
     */
    setSimulationScenario(scenarioId: SimulationScenarioId | null): void;
    /**
     * Activates and evaluates a custom solar event using user-supplied heliographic source
     * coordinates and solar wind parameters (`null` clears the custom override).
     *
     * @param params - Custom eruption and solar wind parameters, or `null` to disable override.
     * @returns Simulated `RadiationEngineState`, or `null` when clearing the custom simulation.
     */
    simulateCustomEvent(params: CustomSimulationParams | null): RadiationEngineState | null;
    /**
     * Retrieves recent coronal mass ejection (CME) analyses and WSA-ENLIL arrival forecasts
     * from NASA DONKI.
     *
     * @returns Recent `NasaCmeAnalysis` forecast records.
     */
    getCmeForecasts(): Promise<import("./clients/nasaDonkiClient").NasaCmeAnalysis[]>;
}
