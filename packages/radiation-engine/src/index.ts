/**
 * @module radiation-engine
 * Public entrypoint for the Deep Space Radiation Prediction Engine.
 *
 * Exports the unified `RadiationEngine` orchestrator along with NOAA SWPC and NASA DONKI
 * telemetry clients, SEP Parker spiral transit physics, cislunar CME impact geometry,
 * NASA-STD-3001 biological dosimetry, NOAA S0-S5 mitigation rules, and the deterministic
 * storm simulator.
 */

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

/**
 * Facade coordinating live NOAA/NASA space-weather telemetry, relativistic SEP prediction,
 * Earth-Moon corridor impact modeling, biological dose calculations, and simulation overrides.
 */
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
   * Retrieves the current space-weather and radiation assessment.
   *
   * Returns simulated state when a custom event or preset scenario is active; otherwise queries
   * live NOAA SWPC and NASA DONKI feeds in parallel, applying per-feed nominal fallback and
   * setting `telemetryDegraded` when one or two primary NOAA feeds fail (or falling back to the
   * `'NOMINAL'` baseline if all three primary NOAA SWPC feeds are unavailable).
   *
   * @returns Consolidated `RadiationEngineState` snapshot.
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
   * Activates or clears a preset storm simulation scenario (`null` restores live telemetry).
   *
   * @param scenarioId - Preset scenario identifier, or `null` to return to live NOAA/NASA feeds.
   */
  setSimulationScenario(scenarioId: SimulationScenarioId | null) {
    this.activeCustomSimulation = null;
    this.activeSimulatedScenario = scenarioId;
  }

  /**
   * Activates and evaluates a custom solar event using user-supplied heliographic source
   * coordinates and solar wind parameters (`null` clears the custom override).
   *
   * @param params - Custom eruption and solar wind parameters, or `null` to disable override.
   * @returns Simulated `RadiationEngineState`, or `null` when clearing the custom simulation.
   */
  simulateCustomEvent(params: CustomSimulationParams | null): RadiationEngineState | null {
    this.activeSimulatedScenario = null;
    this.activeCustomSimulation = params;
    return params ? this.simulator.simulateCustomEvent(params) : null;
  }

  /**
   * Retrieves recent coronal mass ejection (CME) analyses and WSA-ENLIL arrival forecasts
   * from NASA DONKI.
   *
   * @returns Recent `NasaCmeAnalysis` forecast records.
   */
  async getCmeForecasts() {
    return this.nasaClient.getLatestCmeAnalyses();
  }
}
