import { GOESXrayReading, EarlyWarningWindow } from '../types';
export declare class SepPredictionEngine {
    private readonly SPEED_OF_LIGHT;
    private readonly PROTON_REST_MASS_MEV;
    private readonly AU_KM;
    /**
     * Calcula la velocidad relativista v(E) de un protón dada su energía cinética en MeV
     * Retorna la velocidad como fracción de c (beta = v/c)
     */
    calculateRelativisticBeta(energyMev: number): number;
    /**
     * Calcula el tiempo de tránsito por la Espiral de Parker interplanetaria
     * Teniendo en cuenta la trayectoria curva del campo magnético y el ángulo de paso (pitch-angle scattering),
     * la longitud efectiva de la espiral de Parker es típicamente ~1.2 a 1.3 AU,
     * y la difusión/dispersión de las partículas agrega un factor de tránsito de 1.8x a 2.5x para el grueso del flujo (peak flux).
     * Retorna el tiempo en minutos.
     */
    calculateTransitTimeMinutes(energyMev: number, parkerLengthAu?: number, scatteringFactor?: number): number;
    /**
     * Evalúa si una lectura de rayos X representa un "Trigger" de alerta temprana
     * Ventana útil: Tiempo de llegada del flujo pico de protones menos los 8.3 minutos que tardaron los rayos X
     */
    evaluateEarlyWarning(latestXray: GOESXrayReading | null): EarlyWarningWindow;
}
