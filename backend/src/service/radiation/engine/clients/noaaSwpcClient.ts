/**
 * @module service/radiation/engine/clients/noaaSwpcClient
 * NOAA Space Weather Prediction Center (SWPC) telemetry client and L1 solar wind physics helper.
 *
 * Fetches GOES primary soft X-ray flux (W/m^2), GOES integral proton flux (pfu), 1-3 day
 * flare/proton forecast probabilities, and DSCOVR/ACE L1 plasma + IMF telemetry from
 * `https://services.swpc.noaa.gov` with a 5-second timeout on JSON endpoints and optional
 * strict error propagation.
 */

import { NOAASolarProbability, GOESXrayReading, GOESProtonReading, SolarWindReading } from '../types/index.js';

const AU_KM = 149597870.7;
const OMEGA_SUN_RAD_S = 2.7e-6; // Solar equatorial synodic rotation rate (rad/s)
const PROTON_MASS_PDYN_COEFF = 1.6726e-6; // Converts n (cm^-3) * v^2 (km/s)^2 to nPa

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
export function computeSolarWindMetrics(params: {
  timestamp: string;
  speedKmS: number;
  densityPcm3: number;
  temperatureK: number;
  btNt: number;
  bzNt: number;
}): SolarWindReading {
  const speedKmS = Math.max(200, params.speedKmS);
  const densityPcm3 = Math.max(0.1, params.densityPcm3);
  const dynamicPressureNpa = Number(
    (PROTON_MASS_PDYN_COEFF * densityPcm3 * speedKmS * speedKmS).toFixed(2)
  );
  const spiralRad = (OMEGA_SUN_RAD_S * AU_KM) / speedKmS;
  const parkerSpiralAngleDeg = Number(((Math.atan(spiralRad) * 180) / Math.PI).toFixed(1));
  const parkerFootpointLonDeg = Number(Math.min(89, (spiralRad * 180) / Math.PI).toFixed(1));

  return {
    timestamp: params.timestamp,
    speedKmS: Number(speedKmS.toFixed(1)),
    densityPcm3: Number(densityPcm3.toFixed(2)),
    temperatureK: Math.round(params.temperatureK),
    btNt: Number(params.btNt.toFixed(2)),
    bzNt: Number(params.bzNt.toFixed(2)),
    dynamicPressureNpa,
    parkerSpiralAngleDeg,
    parkerFootpointLonDeg
  };
}

/** Fetch behavior options for NOAA SWPC telemetry requests. */
export interface NoaaFetchOptions {
  /** When true, rethrows HTTP/network errors instead of returning nominal baseline fallback data. */
  strict?: boolean;
}

/**
 * HTTP client for NOAA SWPC operational space-weather telemetry feeds.
 */
export class NoaaSwpcClient {
  private readonly baseUrl = 'https://services.swpc.noaa.gov';

  private async fetchNoaaJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`NOAA SWPC HTTP error (${path}): ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /**
   * Fetches 1-, 2-, and 3-day flare (C, M, X) and >=10 MeV proton event probabilities
   * computed by the NOAA SWPC operational forecast model.
   *
   * @param options - Set `strict: true` to propagate fetch errors to callers.
   * @returns Array of daily probability forecasts (falls back to nominal baseline when non-strict).
   */
  async getSolarProbabilities(options: NoaaFetchOptions = {}): Promise<NOAASolarProbability[]> {
    try {
      const data: any = await this.fetchNoaaJson('/json/solar_probabilities.json');
      return (data || []).map((item: any) => ({
        date: item.date,
        cClass1DayPct: item.c_class_1_day ?? 0,
        cClass2DayPct: item.c_class_2_day ?? 0,
        cClass3DayPct: item.c_class_3_day ?? 0,
        mClass1DayPct: item.m_class_1_day ?? 0,
        mClass2DayPct: item.m_class_2_day ?? 0,
        mClass3DayPct: item.m_class_3_day ?? 0,
        xClass1DayPct: item.x_class_1_day ?? 0,
        xClass2DayPct: item.x_class_2_day ?? 0,
        xClass3DayPct: item.x_class_3_day ?? 0,
        protonEvent1DayPct: item['10mev_protons_1_day'] ?? 0,
        protonEvent2DayPct: item['10mev_protons_2_day'] ?? 0,
        protonEvent3DayPct: item['10mev_protons_3_day'] ?? 0,
        polarCapAbsorption: item.polar_cap_absorption ?? 'green'
      }));
    } catch (err) {
      if (options.strict) throw err;
      console.warn('[NoaaSwpcClient] Error fetching probabilities, using fallback:', err);
      return this.getFallbackProbabilities();
    }
  }

  /**
   * Fetches the latest primary GOES satellite soft X-ray flux reading (W/m^2).
   *
   * Extracts both short (0.05-0.4 nm) and long (0.1-0.8 nm) bands and estimates dF/dt (W/m^2/min)
   * across a 5-minute lookback window for impulsive flare detection.
   *
   * @param options - Set `strict: true` to propagate fetch errors to callers.
   * @returns Latest X-ray reading, `null` on empty payload, or nominal C1.2 fallback when non-strict.
   */
  async getLatestXrays(options: NoaaFetchOptions = {}): Promise<GOESXrayReading | null> {
    try {
      const list = await this.fetchNoaaJson<any>('/json/goes/primary/xrays-6-hour.json');
      if (!Array.isArray(list) || list.length === 0) return null;

      // Filter the 0.1-0.8 nm long channel (standard reference band for A/B/C/M/X classification)
      const longChannel = list.filter((x: any) => x.energy === '0.1-0.8nm');
      const shortChannel = list.filter((x: any) => x.energy === '0.05-0.4nm');

      if (longChannel.length === 0) return null;

      const latestLong = longChannel[longChannel.length - 1];
      const previousLong = longChannel.length > 5 ? longChannel[longChannel.length - 6] : longChannel[0];
      const latestShort = shortChannel.length > 0 ? shortChannel[shortChannel.length - 1] : { flux: 0 };

      // Compute 5-minute flux rate of change dF/dt (W/m^2 per minute)
      const fluxDelta = latestLong.flux - previousLong.flux;
      const derivative = fluxDelta / 5; // Over a 5-minute window

      return {
        timestamp: latestLong.time_tag,
        satellite: latestLong.satellite ?? 18,
        fluxShort: latestShort.flux,
        fluxLong: latestLong.flux,
        currentClass: this.fluxToFlareClass(latestLong.flux),
        derivativePerMinute: derivative
      };
    } catch (err) {
      if (options.strict) throw err;
      console.warn('[NoaaSwpcClient] Error fetching GOES X-rays, using fallback:', err);
      return {
        timestamp: new Date().toISOString(),
        satellite: 18,
        fluxShort: 1.2e-8,
        fluxLong: 6.5e-7,
        currentClass: 'C1.2',
        derivativePerMinute: 0
      };
    }
  }

  /**
   * Fetches latest high-energy integral proton flux readings (>=10, >=50, >=100 MeV, in pfu)
   * from the primary GOES satellite to evaluate active solar radiation storms.
   *
   * @param options - Set `strict: true` to propagate fetch errors to callers.
   * @returns Latest proton channel readings in pfu (falls back to quiet baseline when non-strict).
   */
  async getLatestProtons(options: NoaaFetchOptions = {}): Promise<GOESProtonReading[]> {
    try {
      const list = await this.fetchNoaaJson<any>('/json/goes/primary/integral-protons-6-hour.json');
      if (!Array.isArray(list) || list.length === 0) return [];

      const latestTime = list[list.length - 1].time_tag;
      const latestReadings = list.filter((p: any) => p.time_tag === latestTime);

      return latestReadings.map((p: any) => ({
        timestamp: p.time_tag,
        energyChannel: p.energy,
        fluxPfu: p.flux
      }));
    } catch (err) {
      if (options.strict) throw err;
      console.warn('[NoaaSwpcClient] Error fetching GOES protons, using fallback:', err);
      return [
        { timestamp: new Date().toISOString(), energyChannel: '>=10 MeV', fluxPfu: 0.8 },
        { timestamp: new Date().toISOString(), energyChannel: '>=50 MeV', fluxPfu: 0.1 },
        { timestamp: new Date().toISOString(), energyChannel: '>=100 MeV', fluxPfu: 0.02 }
      ];
    }
  }

  /**
   * Fetches 2-hour L1 solar wind plasma and interplanetary magnetic field (IMF) telemetry
   * from DSCOVR/ACE and computes derived dynamic pressure and Parker spiral geometry.
   *
   * @returns Latest `SolarWindReading`, or nominal quiet solar wind metrics on feed error.
   */
  async getLatestSolarWind(): Promise<SolarWindReading> {
    try {
      const [plasmaRes, magRes] = await Promise.all([
        fetch(`${this.baseUrl}/products/solar-wind/plasma-2-hour.json`),
        fetch(`${this.baseUrl}/products/solar-wind/mag-2-hour.json`)
      ]);

      if (!plasmaRes.ok || !magRes.ok) {
        throw new Error(`NOAA solar wind HTTP error: plasma=${plasmaRes.status}, mag=${magRes.status}`);
      }

      const plasmaRows = (await plasmaRes.json()) as unknown[][];
      const magRows = (await magRes.json()) as unknown[][];

      // Row 0 is header: ["time_tag","density","speed","temperature"]
      const latestPlasma = Array.isArray(plasmaRows)
        ? [...plasmaRows].reverse().find((r, idx) => idx < plasmaRows.length - 1 && r?.[1] != null && r?.[2] != null)
        : undefined;
      // Row 0 is header: ["time_tag","bx_gsm","by_gsm","bz_gsm","lon_gsm","lat_gsm","bt"]
      const latestMag = Array.isArray(magRows)
        ? [...magRows].reverse().find((r, idx) => idx < magRows.length - 1 && r?.[3] != null && r?.[6] != null)
        : undefined;

      if (!latestPlasma || !latestMag) {
        throw new Error('NOAA solar wind JSON did not contain valid telemetry rows');
      }

      return computeSolarWindMetrics({
        timestamp: String(latestPlasma[0] ?? new Date().toISOString()),
        densityPcm3: Number(latestPlasma[1]),
        speedKmS: Number(latestPlasma[2]),
        temperatureK: Number(latestPlasma[3] ?? 95000),
        bzNt: Number(latestMag[3]),
        btNt: Number(latestMag[6])
      });
    } catch (err) {
      console.warn('[NoaaSwpcClient] Error fetching solar wind, using fallback:', err);
      return computeSolarWindMetrics({
        timestamp: new Date().toISOString(),
        speedKmS: 420,
        densityPcm3: 5.2,
        temperatureK: 98000,
        btNt: 5.4,
        bzNt: -1.8
      });
    }
  }

  /**
   * Converts GOES 0.1-0.8 nm X-ray flux (W/m^2) into the official solar flare classification (A, B, C, M, X).
   *
   * @param flux - Long-channel X-ray irradiance in W/m^2.
   * @returns Flare class label (e.g., `'C1.2'`, `'M5.0'`, `'X4.5'`).
   */
  fluxToFlareClass(flux: number): string {
    if (flux >= 1e-4) {
      return `X${(flux / 1e-4).toFixed(1)}`;
    } else if (flux >= 1e-5) {
      return `M${(flux / 1e-5).toFixed(1)}`;
    } else if (flux >= 1e-6) {
      return `C${(flux / 1e-6).toFixed(1)}`;
    } else if (flux >= 1e-7) {
      return `B${(flux / 1e-7).toFixed(1)}`;
    } else {
      return `A${(flux / 1e-8).toFixed(1)}`;
    }
  }

  private getFallbackProbabilities(): NOAASolarProbability[] {
    return [
      {
        date: new Date().toISOString(),
        cClass1DayPct: 85,
        cClass2DayPct: 85,
        cClass3DayPct: 85,
        mClass1DayPct: 25,
        mClass2DayPct: 20,
        mClass3DayPct: 20,
        xClass1DayPct: 5,
        xClass2DayPct: 5,
        xClass3DayPct: 5,
        protonEvent1DayPct: 5,
        protonEvent2DayPct: 5,
        protonEvent3DayPct: 5,
        polarCapAbsorption: 'green'
      }
    ];
  }
}
