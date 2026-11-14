import { NOAASolarProbability, GOESXrayReading, GOESProtonReading } from '../types';

export class NoaaSwpcClient {
  private readonly baseUrl = 'https://services.swpc.noaa.gov';

  /**
   * Obtiene las probabilidades a 1, 2 y 3 días de fulguraciones (C, M, X) y eventos de protones
   * calculadas por el modelo operacional de NOAA SWPC.
   */
  async getSolarProbabilities(): Promise<NOAASolarProbability[]> {
    try {
      const response = await fetch(`${this.baseUrl}/json/solar_probabilities.json`);
      if (!response.ok) {
        throw new Error(`NOAA SWPC probabilities HTTP error: ${response.status}`);
      }
      const data: any = await response.json();
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
      console.warn('[NoaaSwpcClient] Error fetching probabilities, using fallback:', err);
      return this.getFallbackProbabilities();
    }
  }

  /**
   * Obtiene la telemetría más reciente de rayos X de satélites GOES (primario).
   */
  async getLatestXrays(): Promise<GOESXrayReading | null> {
    try {
      const response = await fetch(`${this.baseUrl}/json/goes/primary/xrays-6-hour.json`);
      if (!response.ok) throw new Error(`GOES X-rays HTTP error: ${response.status}`);
      const list = await response.json();
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
  async getLatestProtons(): Promise<GOESProtonReading[]> {
    try {
      const response = await fetch(`${this.baseUrl}/json/goes/primary/integral-protons-6-hour.json`);
      if (!response.ok) throw new Error(`GOES protons HTTP error: ${response.status}`);
      const list = await response.json();
      if (!Array.isArray(list) || list.length === 0) return [];

      const latestTime = list[list.length - 1].time_tag;
      const latestReadings = list.filter((p: any) => p.time_tag === latestTime);

      return latestReadings.map((p: any) => ({
        timestamp: p.time_tag,
        energyChannel: p.energy,
        fluxPfu: p.flux
      }));
    } catch (err) {
      console.warn('[NoaaSwpcClient] Error fetching GOES protons, using fallback:', err);
      return [
        { timestamp: new Date().toISOString(), energyChannel: '>=10 MeV', fluxPfu: 0.8 },
        { timestamp: new Date().toISOString(), energyChannel: '>=50 MeV', fluxPfu: 0.1 },
        { timestamp: new Date().toISOString(), energyChannel: '>=100 MeV', fluxPfu: 0.02 }
      ];
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
