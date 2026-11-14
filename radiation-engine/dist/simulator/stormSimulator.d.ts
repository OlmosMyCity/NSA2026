import { RadiationEngineState } from '../types';
export type SimulationScenarioId = 'NOMINAL' | 'FLARE_EARLY_WARNING' | 'PEAK_STORM_S4';
export declare class StormSimulator {
    private doseCalculator;
    private sepEngine;
    private mitigationEngine;
    /**
     * Genera el estado completo del motor según el escenario de simulación seleccionado
     */
    getSimulatedState(scenarioId: SimulationScenarioId): RadiationEngineState;
    private getProbabilitiesForStorm;
    private getProbabilitiesNominal;
}
