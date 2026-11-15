/**
 * @module clients/noaaSwpcClient
 * NOAA Space Weather Prediction Center (SWPC) telemetry client and L1 solar wind physics helper.
 *
 * Fetches GOES primary soft X-ray flux (W/m^2), GOES integral proton flux (pfu), 1-3 day
 * flare/proton forecast probabilities, and DSCOVR/ACE L1 plasma + IMF telemetry from
 * `https://services.swpc.noaa.gov` with a 5-second timeout on JSON endpoints and optional
 * strict error propagation.
 */
import { NOAASolarProbability, GOESXrayReading, GOESProtonReading, SolarWindReading } from '../types';
/**
 * Derives solar wind dynamic pressure and Parker spiral geometry at 1 AU from L1 plasma/IMF inputs.
 *
 * Computes ram pressure $P_{\text{dyn}} = m_p n v^2$ in nPa (converted via $1.6726\times 10^{-6}$),
 * spiral winding angle $\arctan(\Omega_\odot \cdot 1\text{ AU} / v_{\text{sw}})$, and Earth-connected
 * solar magnetic footpoint longitude in degrees West (clamped at 89 deg).
 *
 * @param params - Raw solar wind speed (km/s), proton density (p/cm^3), temperature (K), and IMF Bt/Bz (nT).
 * @returns Normalized `SolarWindReading` with dynamic pressure (nPa) and Parker spiral angles (deg).
 */
export declare function computeSolarWindMetrics(params: {
    timestamp: string;
    speedKmS: number;
    densityPcm3: number;
    temperatureK: number;
    btNt: number;
    bzNt: number;
}): SolarWindReading;
/** Fetch behavior options for NOAA SWPC telemetry requests. */
export interface NoaaFetchOptions {
    /** When true, rethrows HTTP/network errors instead of returning nominal baseline fallback data. */
    strict?: boolean;
}
/**
 * HTTP client for NOAA SWPC operational space-weather telemetry feeds.
 */
export declare class NoaaSwpcClient {
    private readonly baseUrl;
    private fetchNoaaJson;
    /**
     * Fetches 1-, 2-, and 3-day flare (C, M, X) and >=10 MeV proton event probabilities
     * computed by the NOAA SWPC operational forecast model.
     *
     * @param options - Set `strict: true` to propagate fetch errors to callers.
     * @returns Array of daily probability forecasts (falls back to nominal baseline when non-strict).
     */
    getSolarProbabilities(options?: NoaaFetchOptions): Promise<NOAASolarProbability[]>;
    /**
     * Fetches the latest primary GOES satellite soft X-ray flux reading (W/m^2).
     *
     * Extracts both short (0.05-0.4 nm) and long (0.1-0.8 nm) bands and estimates dF/dt (W/m^2/min)
     * across a 5-minute lookback window for impulsive flare detection.
     *
     * @param options - Set `strict: true` to propagate fetch errors to callers.
     * @returns Latest X-ray reading, `null` on empty payload, or nominal C1.2 fallback when non-strict.
     */
    getLatestXrays(options?: NoaaFetchOptions): Promise<GOESXrayReading | null>;
    /**
     * Fetches latest high-energy integral proton flux readings (>=10, >=50, >=100 MeV, in pfu)
     * from the primary GOES satellite to evaluate active solar radiation storms.
     *
     * @param options - Set `strict: true` to propagate fetch errors to callers.
     * @returns Latest proton channel readings in pfu (falls back to quiet baseline when non-strict).
     */
    getLatestProtons(options?: NoaaFetchOptions): Promise<GOESProtonReading[]>;
    /**
     * Fetches 2-hour L1 solar wind plasma and interplanetary magnetic field (IMF) telemetry
     * from DSCOVR/ACE and computes derived dynamic pressure and Parker spiral geometry.
     *
     * @returns Latest `SolarWindReading`, or nominal quiet solar wind metrics on feed error.
     */
    getLatestSolarWind(): Promise<SolarWindReading>;
    /**
     * Converts GOES 0.1-0.8 nm X-ray flux (W/m^2) into the official solar flare classification (A, B, C, M, X).
     *
     * @param flux - Long-channel X-ray irradiance in W/m^2.
     * @returns Flare class label (e.g., `'C1.2'`, `'M5.0'`, `'X4.5'`).
     */
    fluxToFlareClass(flux: number): string;
    private getFallbackProbabilities;
}
