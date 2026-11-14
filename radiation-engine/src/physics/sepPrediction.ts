import { GOESXrayReading, EarlyWarningWindow, NOAAStormScale } from '../types';

export class SepPredictionEngine {
  // Constantes físicas
  private readonly SPEED_OF_LIGHT = 299792.458; // km/s
  private readonly PROTON_REST_MASS_MEV = 938.272; // MeV
  private readonly AU_KM = 149597870.7; // 1 Unidad Astronómica en km

  /**
   * Calcula la velocidad relativista v(E) de un protón dada su energía cinética en MeV
   * Retorna la velocidad como fracción de c (beta = v/c)
   */
  calculateRelativisticBeta(energyMev: number): number {
    const gamma = 1 + energyMev / this.PROTON_REST_MASS_MEV;
    const beta = Math.sqrt(1 - 1 / (gamma * gamma));
    return beta;
  }

  /**
   * Calcula el tiempo de tránsito por la Espiral de Parker interplanetaria
   * Teniendo en cuenta la trayectoria curva del campo magnético y el ángulo de paso (pitch-angle scattering),
   * la longitud efectiva de la espiral de Parker es típicamente ~1.2 a 1.3 AU,
   * y la difusión/dispersión de las partículas agrega un factor de tránsito de 1.8x a 2.5x para el grueso del flujo (peak flux).
   * Retorna el tiempo en minutos.
   */
  calculateTransitTimeMinutes(energyMev: number, parkerLengthAu = 1.25, scatteringFactor = 2.0): number {
    const beta = this.calculateRelativisticBeta(energyMev);
    const speedKmS = beta * this.SPEED_OF_LIGHT;
    const directDistanceKm = parkerLengthAu * this.AU_KM;
    const effectiveDistanceKm = directDistanceKm * scatteringFactor;
    const transitSeconds = effectiveDistanceKm / speedKmS;
    return transitSeconds / 60;
  }

  /**
   * Evalúa si una lectura de rayos X representa un "Trigger" de alerta temprana
   * Ventana útil: Tiempo de llegada del flujo pico de protones menos los 8.3 minutos que tardaron los rayos X
   */
  evaluateEarlyWarning(latestXray: GOESXrayReading | null): EarlyWarningWindow {
    if (!latestXray) {
      return {
        isWarningActive: false,
        triggerEvent: null,
        flareOnsetTimestamp: null,
        estimatedProtonArrivalMinutes: null,
        estimatedPeakFluxPfu: null,
        predictedStormScale: 'S0_NOMINAL',
        confidenceScore: 0.0
      };
    }

    const flux = latestXray.fluxLong;
    const dFdt = latestXray.derivativePerMinute;

    // Umbral: Fulguraciones M5 (5e-5) o superiores (especialmente clase X >= 1e-4)
    // O tasa de subida violenta en clase M
    const isMajorFlare = flux >= 5e-5;
    const isViolentRise = flux >= 2e-5 && dFdt > 5e-6;

    if (!isMajorFlare && !isViolentRise) {
      return {
        isWarningActive: false,
        triggerEvent: null,
        flareOnsetTimestamp: null,
        estimatedProtonArrivalMinutes: null,
        estimatedPeakFluxPfu: null,
        predictedStormScale: 'S0_NOMINAL',
        confidenceScore: 0.1
      };
    }

    // Protones típicos de riesgo biológico: 50 a 100 MeV
    const transitTime100Mev = this.calculateTransitTimeMinutes(100); // ~48 minutos
    const lightTravelTimeMinutes = 8.32; // Tiempo que tardó la luz del flare en ser vista

    // Margen de alerta temprana disponible desde la detección de rayos X
    const warningLeadTimeMinutes = Math.max(20, Math.round(transitTime100Mev - lightTravelTimeMinutes));

    // Estimar escala potencial según clase de flare
    let predictedStormScale: NOAAStormScale = 'S1_MINOR';
    let estimatedPeakFluxPfu = 15;

    if (flux >= 5e-4) { // Flare >= X5
      predictedStormScale = 'S4_SEVERE';
      estimatedPeakFluxPfu = 12000;
    } else if (flux >= 1e-4) { // Flare X1 - X4
      predictedStormScale = 'S3_STRONG';
      estimatedPeakFluxPfu = 2500;
    } else if (flux >= 5e-5) { // Flare M5 - M9
      predictedStormScale = 'S2_MODERATE';
      estimatedPeakFluxPfu = 250;
    }

    return {
      isWarningActive: true,
      triggerEvent: `High-Energy Solar Flare (${latestXray.currentClass}) detected by GOES-${latestXray.satellite}`,
      flareOnsetTimestamp: latestXray.timestamp,
      estimatedProtonArrivalMinutes: warningLeadTimeMinutes,
      estimatedPeakFluxPfu: estimatedPeakFluxPfu,
      predictedStormScale: predictedStormScale,
      confidenceScore: flux >= 1e-4 ? 0.88 : 0.72
    };
  }
}
