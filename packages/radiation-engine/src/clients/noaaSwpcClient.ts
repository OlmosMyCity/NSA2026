import { NOAASolarProbability, GOESXrayReading, GOESProtonReading, SolarWindReading } from '../types';

const AU_KM = 149597870.7;
const OMEGA_SUN_RAD_S = 2.7e-6; // Solar equatorial synodic rotation rate (rad/s)
const PROTON_MASS_PDYN_COEFF = 1.6726e-6; // Converts n (cm^-3) * v^2 (km/s)^2 to nPa

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

export interface NoaaFetchOptions {
  strict?: boolean;
}

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
   * Obtiene las probabilidades a 1, 2 y 3 días de fulguraciones (C, M, X) y eventos de protones
   * calculadas por el modelo operacional de NOAA SWPC.
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
   * Obtiene la telemetría más reciente de rayos X de satélites GOES (primario).
   */
  async getLatestXrays(options: NoaaFetchOptions = {}): Promise<GOESXrayReading | null> {
    try {
      const list = await this.fetchNoaaJson<any>('/json/goes/primary/xrays-6-hour.json');
      if (!Array.isArray(list) || list.length === 0) return null;

      // Filtrar el canal 0.1-0.8nm (estándar para clasificación B, C, M, X)
      const longChannel = list.filter((x: any) => x.energy === '0.1-0.8nm');
      const shortChannel = list.filter((x: any) => x.energy === '0.05-0.4nm');

      if (longChannel.length === 0) return null;

      const latestLong = longChannel[longChannel.length - 1];
      const previousLong = longChannel.length > 5 ? longChannel[longChannel.length - 6] : longChannel[0];
      const latestShort = shortChannel.length > 0 ? shortChannel[shortChannel.length - 1] : { flux: 0 };

      // Calcular la derivada por minuto dF/dt
      const fluxDelta = latestLong.flux - previousLong.flux;
      const derivative = fluxDelta / 5; // En 5 minutos

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
   * Obtiene la telemetría de protones de alta energía (para evaluar tormenta en curso)
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
   * Obtiene telemetría de viento solar (plasma y campo magnético IMF) de DSCOVR/ACE en L1
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
   * Convierte flujo de rayos X (W/m²) a la escala oficial de fulguraciones (A, B, C, M, X)
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
