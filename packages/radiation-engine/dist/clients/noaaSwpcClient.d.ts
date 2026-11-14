import { NOAASolarProbability, GOESXrayReading, GOESProtonReading } from '../types';
export interface NoaaFetchOptions {
    strict?: boolean;
}
export declare class NoaaSwpcClient {
    private readonly baseUrl;
    private fetchNoaaJson;
    /**
     * Obtiene las probabilidades a 1, 2 y 3 días de fulguraciones (C, M, X) y eventos de protones
     * calculadas por el modelo operacional de NOAA SWPC.
     */
    getSolarProbabilities(options?: NoaaFetchOptions): Promise<NOAASolarProbability[]>;
    /**
     * Obtiene la telemetría más reciente de rayos X de satélites GOES (primario).
     */
    getLatestXrays(options?: NoaaFetchOptions): Promise<GOESXrayReading | null>;
    /**
     * Obtiene la telemetría de protones de alta energía (para evaluar tormenta en curso)
     */
    getLatestProtons(options?: NoaaFetchOptions): Promise<GOESProtonReading[]>;
    /**
     * Convierte flujo de rayos X (W/m²) a la escala oficial de fulguraciones (A, B, C, M, X)
     */
    fluxToFlareClass(flux: number): string;
    private getFallbackProbabilities;
}
