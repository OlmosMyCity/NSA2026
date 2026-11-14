import { NOAASolarProbability, GOESXrayReading, GOESProtonReading } from '../types';
export declare class NoaaSwpcClient {
    private readonly baseUrl;
    /**
     * Obtiene las probabilidades a 1, 2 y 3 días de fulguraciones (C, M, X) y eventos de protones
     * calculadas por el modelo operacional de NOAA SWPC.
     */
    getSolarProbabilities(): Promise<NOAASolarProbability[]>;
    /**
     * Obtiene la telemetría más reciente de rayos X de satélites GOES (primario).
     */
    getLatestXrays(): Promise<GOESXrayReading | null>;
    /**
     * Obtiene la telemetría de protones de alta energía (para evaluar tormenta en curso)
     */
    getLatestProtons(): Promise<GOESProtonReading[]>;
    /**
     * Convierte flujo de rayos X (W/m²) a la escala oficial de fulguraciones (A, B, C, M, X)
     */
    fluxToFlareClass(flux: number): string;
    private getFallbackProbabilities;
}
