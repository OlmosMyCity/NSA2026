/**
 * @module clients/nasaDonkiClient
 * NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) CME analysis client.
 *
 * Queries the `/CMEAnalysis` endpoint for `mostAccurateOnly` coronal mass ejection (CME)
 * kinematic solutions (speed >= 500 km/s) and WSA-ENLIL shock arrival estimates over a trailing
 * 14-day window, with a baseline CME fallback when upstream requests fail.
 */
/** Normalized coronal mass ejection (CME) kinematic analysis and WSA-ENLIL shock estimate. */
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
/**
 * HTTP client for retrieving NASA DONKI CME kinematic analyses and WSA-ENLIL forecasts.
 */
export declare class NasaDonkiClient {
    private readonly baseUrl;
    private readonly apiKey;
    /**
     * Initializes a NASA DONKI client.
     *
     * @param apiKey - NASA Open API key (defaults to `'DEMO_KEY'`).
     */
    constructor(apiKey?: string);
    /**
     * Fetches up to the 5 most recent CME analyses processed with the WSA-ENLIL kinematic model
     * across the trailing 14-day window (`speed >= 500 km/s`, `mostAccurateOnly=true`).
     *
     * Falls back to a representative nominal Earth/Moon-targeted CME forecast if DONKI is unreachable.
     *
     * @returns Recent CME analysis records including Stonyhurst source, cone half-angle, speed (km/s), and shock ETA.
     */
    getLatestCmeAnalyses(): Promise<NasaCmeAnalysis[]>;
    private getFallbackCmes;
}
