import { NoaaSwpcClient } from './clients/noaaSwpcClient';
import { NasaDonkiClient } from './clients/nasaDonkiClient';
import { SepPredictionEngine } from './physics/sepPrediction';
import { DoseCalculator } from './physics/doseCalculator';
import { MitigationRulesEngine } from './alert/mitigationRules';
import { StormSimulator, SimulationScenarioId } from './simulator/stormSimulator';
import { RadiationEngineState } from './types';
export * from './types';
export { NoaaSwpcClient, NasaDonkiClient, SepPredictionEngine, DoseCalculator, MitigationRulesEngine, StormSimulator };
export declare class RadiationEngine {
    private noaaClient;
    private nasaClient;
    private sepEngine;
    private doseCalculator;
    private mitigationEngine;
    private simulator;
    private activeSimulatedScenario;
    /**
     * Obtiene el estado actual del clima espacial y radiación
     * Si hay un escenario de simulación activo, devuelve el estado simulado.
     * De lo contrario, consulta las APIs en vivo de NOAA y NASA.
     */
    getCurrentState(): Promise<RadiationEngineState>;
    /**
     * Activa o desactiva un escenario simulado (ideal para la demo del jurado)
     */
    setSimulationScenario(scenarioId: SimulationScenarioId | null): void;
    /**
     * Obtiene los pronósticos de impacto de eyecciones de masa coronal (WSA-ENLIL de NASA DONKI)
     */
    getCmeForecasts(): Promise<import("./clients/nasaDonkiClient").NasaCmeAnalysis[]>;
}
