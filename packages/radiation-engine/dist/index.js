"use strict";
/**
 * @module radiation-engine
 * Public entrypoint for the Deep Space Radiation Prediction Engine.
 *
 * Exports the unified `RadiationEngine` orchestrator along with NOAA SWPC and NASA DONKI
 * telemetry clients, SEP Parker spiral transit physics, cislunar CME impact geometry,
 * NASA-STD-3001 biological dosimetry, NOAA S0-S5 mitigation rules, and the deterministic
 * storm simulator.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiationEngine = exports.computeSolarWindMetrics = exports.StormSimulator = exports.MitigationRulesEngine = exports.DoseCalculator = exports.SolarWindImpactPredictor = exports.SepPredictionEngine = exports.NasaDonkiClient = exports.NoaaSwpcClient = void 0;
const noaaSwpcClient_1 = require("./clients/noaaSwpcClient");
Object.defineProperty(exports, "NoaaSwpcClient", { enumerable: true, get: function () { return noaaSwpcClient_1.NoaaSwpcClient; } });
Object.defineProperty(exports, "computeSolarWindMetrics", { enumerable: true, get: function () { return noaaSwpcClient_1.computeSolarWindMetrics; } });
const nasaDonkiClient_1 = require("./clients/nasaDonkiClient");
Object.defineProperty(exports, "NasaDonkiClient", { enumerable: true, get: function () { return nasaDonkiClient_1.NasaDonkiClient; } });
const sepPrediction_1 = require("./physics/sepPrediction");
Object.defineProperty(exports, "SepPredictionEngine", { enumerable: true, get: function () { return sepPrediction_1.SepPredictionEngine; } });
const solarWindImpact_1 = require("./physics/solarWindImpact");
Object.defineProperty(exports, "SolarWindImpactPredictor", { enumerable: true, get: function () { return solarWindImpact_1.SolarWindImpactPredictor; } });
const doseCalculator_1 = require("./physics/doseCalculator");
Object.defineProperty(exports, "DoseCalculator", { enumerable: true, get: function () { return doseCalculator_1.DoseCalculator; } });
const mitigationRules_1 = require("./alert/mitigationRules");
Object.defineProperty(exports, "MitigationRulesEngine", { enumerable: true, get: function () { return mitigationRules_1.MitigationRulesEngine; } });
const stormSimulator_1 = require("./simulator/stormSimulator");
Object.defineProperty(exports, "StormSimulator", { enumerable: true, get: function () { return stormSimulator_1.StormSimulator; } });
__exportStar(require("./types"), exports);
/**
 * Facade coordinating live NOAA/NASA space-weather telemetry, relativistic SEP prediction,
 * Earth-Moon corridor impact modeling, biological dose calculations, and simulation overrides.
 */
class RadiationEngine {
    noaaClient = new noaaSwpcClient_1.NoaaSwpcClient();
    nasaClient = new nasaDonkiClient_1.NasaDonkiClient();
    sepEngine = new sepPrediction_1.SepPredictionEngine();
    impactPredictor = new solarWindImpact_1.SolarWindImpactPredictor();
    doseCalculator = new doseCalculator_1.DoseCalculator();
    mitigationEngine = new mitigationRules_1.MitigationRulesEngine();
    simulator = new stormSimulator_1.StormSimulator();
    activeSimulatedScenario = null;
    activeCustomSimulation = null;
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
    async getCurrentState() {
        if (this.activeCustomSimulation) {
            return this.simulator.simulateCustomEvent(this.activeCustomSimulation);
        }
        if (this.activeSimulatedScenario) {
            return this.simulator.getSimulatedState(this.activeSimulatedScenario);
        }
        try {
            const [probabilitiesRes, latestXrayRes, latestProtonsRes, solarWindRes, cmesRes] = await Promise.allSettled([
                this.noaaClient.getSolarProbabilities({ strict: true }),
                this.noaaClient.getLatestXrays({ strict: true }),
                this.noaaClient.getLatestProtons({ strict: true }),
                this.noaaClient.getLatestSolarWind(),
                this.nasaClient.getLatestCmeAnalyses()
            ]);
            const degradedFeeds = [];
            if (probabilitiesRes.status === 'rejected')
                degradedFeeds.push('solar_probabilities');
            if (latestXrayRes.status === 'rejected')
                degradedFeeds.push('goes_xrays');
            if (latestProtonsRes.status === 'rejected')
                degradedFeeds.push('goes_protons');
            if (degradedFeeds.length === 3) {
                throw new Error('All NOAA SWPC live feeds unavailable.');
            }
            const nominalFallback = degradedFeeds.length > 0 || solarWindRes.status === 'rejected'
                ? this.simulator.getSimulatedState('NOMINAL')
                : null;
            const probabilities = probabilitiesRes.status === 'fulfilled'
                ? probabilitiesRes.value
                : nominalFallback.probabilities;
            const latestXray = latestXrayRes.status === 'fulfilled'
                ? latestXrayRes.value
                : nominalFallback.currentTelemetry.latestXray;
            const latestProtons = latestProtonsRes.status === 'fulfilled'
                ? latestProtonsRes.value
                : nominalFallback.currentTelemetry.latestProtons;
            const solarWind = solarWindRes.status === 'fulfilled' ? solarWindRes.value : nominalFallback.solarWind;
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
        }
        catch (err) {
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
    setSimulationScenario(scenarioId) {
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
    simulateCustomEvent(params) {
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
exports.RadiationEngine = RadiationEngine;
