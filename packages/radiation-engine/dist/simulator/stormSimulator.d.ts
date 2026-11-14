import { RadiationEngineState } from '../types';
export type SimulationScenarioId = 'NOMINAL' | 'FLARE_EARLY_WARNING' | 'PEAK_STORM_S4' | 'SIDE_MISS_CME';
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
export declare class StormSimulator {
    private doseCalculator;
    private sepEngine;
    private impactPredictor;
    private mitigationEngine;
    /**
     * Genera el estado completo del motor según el escenario de simulación seleccionado
     */
    getSimulatedState(scenarioId: SimulationScenarioId): RadiationEngineState;
    /**
     * Simula un evento personalizado a partir de una coordenada heliográfica (ej. "N15W45" o "S20E70")
     */
    simulateCustomEvent(params: CustomSimulationParams): RadiationEngineState;
    private getProbabilitiesForStorm;
    private getProbabilitiesNominal;
}
