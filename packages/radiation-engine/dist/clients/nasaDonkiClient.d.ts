export interface NasaCmeAnalysis {
    activityId: string;
    catalog: string;
    startTime: string;
    sourceLocation: string;
    halfAngle: number;
    speed: number;
    type: string;
    isEarthOrMoonTargeted: boolean;
    estimatedShockArrivalTime?: string;
}
export declare class NasaDonkiClient {
    private readonly baseUrl;
    private readonly apiKey;
    constructor(apiKey?: string);
    /**
     * Obtiene los últimos análisis de CME procesados con el modelo cinemático WSA-ENLIL
     */
    getLatestCmeAnalyses(): Promise<NasaCmeAnalysis[]>;
    private getFallbackCmes;
}
