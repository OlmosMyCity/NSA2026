import { NoaaSwpcClient, computeSolarWindMetrics } from './clients/noaaSwpcClient';
import { NasaDonkiClient } from './clients/nasaDonkiClient';
import { SepPredictionEngine } from './physics/sepPrediction';
import { SolarWindImpactPredictor } from './physics/solarWindImpact';
import { DoseCalculator } from './physics/doseCalculator';
import { MitigationRulesEngine } from './alert/mitigationRules';
import {
  StormSimulator,
  SimulationScenarioId,
  CustomSimulationParams
} from './simulator/stormSimulator';
import { RadiationEngineState } from './types';

export * from './types';
export {
  NoaaSwpcClient,
  NasaDonkiClient,
  SepPredictionEngine,
  SolarWindImpactPredictor,
  DoseCalculator,
  MitigationRulesEngine,
  StormSimulator,
  computeSolarWindMetrics
};
export type { SimulationScenarioId, CustomSimulationParams };

export class RadiationEngine {
  private noaaClient = new NoaaSwpcClient();
  private nasaClient = new NasaDonkiClient();
  private sepEngine = new SepPredictionEngine();
  private impactPredictor = new SolarWindImpactPredictor();
  private doseCalculator = new DoseCalculator();
  private mitigationEngine = new MitigationRulesEngine();
  private simulator = new StormSimulator();

  private activeSimulatedScenario: SimulationScenarioId | null = null;
  private activeCustomSimulation: CustomSimulationParams | null = null;

  /**
   * Obtiene el estado actual del clima espacial y radiación
   * Si hay un escenario de simulación activo, devuelve el estado simulado.
   * De lo contrario, consulta las APIs en vivo de NOAA y NASA.
   */
  async getCurrentState(): Promise<RadiationEngineState> {
    if (this.activeCustomSimulation) {
      return this.simulator.simulateCustomEvent(this.activeCustomSimulation);
    }

    if (this.activeSimulatedScenario) {
      return this.simulator.getSimulatedState(this.activeSimulatedScenario);
    }

    try {
      const [probabilitiesRes, latestXrayRes, latestProtonsRes, solarWindRes, cmesRes] =
        await Promise.allSettled([
          this.noaaClient.getSolarProbabilities({ strict: true }),
          this.noaaClient.getLatestXrays({ strict: true }),
          this.noaaClient.getLatestProtons({ strict: true }),
          this.noaaClient.getLatestSolarWind(),
          this.nasaClient.getLatestCmeAnalyses()
        ]);

      const degradedFeeds: string[] = [];
      if (probabilitiesRes.status === 'rejected') degradedFeeds.push('solar_probabilities');
      if (latestXrayRes.status === 'rejected') degradedFeeds.push('goes_xrays');
      if (latestProtonsRes.status === 'rejected') degradedFeeds.push('goes_protons');

      if (degradedFeeds.length === 3) {
        throw new Error('All NOAA SWPC live feeds unavailable.');
      }

      const nominalFallback =
        degradedFeeds.length > 0 || solarWindRes.status === 'rejected'
          ? this.simulator.getSimulatedState('NOMINAL')
          : null;
      const probabilities =
        probabilitiesRes.status === 'fulfilled'
          ? probabilitiesRes.value
          : nominalFallback!.probabilities;
      const latestXray =
        latestXrayRes.status === 'fulfilled'
          ? latestXrayRes.value
          : nominalFallback!.currentTelemetry.latestXray;
      const latestProtons =
        latestProtonsRes.status === 'fulfilled'
          ? latestProtonsRes.value
          : nominalFallback!.currentTelemetry.latestProtons;
      const solarWind =
        solarWindRes.status === 'fulfilled' ? solarWindRes.value : nominalFallback!.solarWind;
      const cmes = cmesRes.status === 'fulfilled' ? cmesRes.value : [];

      const primaryProtonFlux = latestProtons.find(p => p.energyChannel.includes('10'))?.fluxPfu ?? 0.8;
      const stormScale = this.mitigationEngine.evaluateStormScale(primaryProtonFlux);
      const earlyWarning = this.sepEngine.evaluateEarlyWarning(latestXray);
      const biologicalDoses = this.doseCalculator.getAllShieldingEstimates(primaryProtonFlux);
      const mitigation = this.mitigationEngine.generateProtocol(stormScale);

      const latestCme = cmes[cmes.length - 1];
      const impactPrediction = this.impactPredictor.predictImpact({
        sourceLocation: latestCme?.sourceLocation ?? 'N05W12',
        coneHalfAngleDeg: latestCme?.halfAngle ?? 35,
        cmeSpeedKmS: latestCme?.speed ?? solarWind.speedKmS,
        solarWind,
        predictedStormScale: earlyWarning.isWarningActive ? earlyWarning.predictedStormScale : stormScale,
        sepArrivalMinutes: earlyWarning.estimatedProtonArrivalMinutes
      });

      return {
        timestamp: new Date().toISOString(),
        isSimulated: false,
        telemetryDegraded: degradedFeeds.length > 0,
        ...(degradedFeeds.length > 0
          ? { degradationReason: `NOAA SWPC feeds unavailable: ${degradedFeeds.join(', ')}` }
          : {}),
        probabilities,
        currentTelemetry: {
          latestXray,
          latestProtons,
          stormScale
        },
        solarWind,
        earlyWarning,
        impactPrediction,
        biologicalDoses,
        mitigation
      };
    } catch (err) {
      console.warn('[RadiationEngine] Error compiling live state, falling back to nominal baseline:', err);
      const fallback = this.simulator.getSimulatedState('NOMINAL');
      return {
        ...fallback,
        telemetryDegraded: true,
        degradationReason: 'NOAA SWPC live telemetry unavailable; reporting nominal baseline fallback.',
      };
    }
  }

  /**
   * Activa o desactiva un escenario simulado (ideal para la demo del jurado)
   */
  setSimulationScenario(scenarioId: SimulationScenarioId | null) {
    this.activeCustomSimulation = null;
    this.activeSimulatedScenario = scenarioId;
  }

  /**
   * Simula un evento personalizado con origen heliográfico y parámetros de viento solar
   */
  simulateCustomEvent(params: CustomSimulationParams | null): RadiationEngineState | null {
    this.activeSimulatedScenario = null;
    this.activeCustomSimulation = params;
    return params ? this.simulator.simulateCustomEvent(params) : null;
  }

  /**
   * Obtiene los pronósticos de impacto de eyecciones de masa coronal (WSA-ENLIL de NASA DONKI)
   */
  async getCmeForecasts() {
    return this.nasaClient.getLatestCmeAnalyses();
  }
}
