"use strict";
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
exports.RadiationEngine = exports.StormSimulator = exports.MitigationRulesEngine = exports.DoseCalculator = exports.SepPredictionEngine = exports.NasaDonkiClient = exports.NoaaSwpcClient = void 0;
const noaaSwpcClient_1 = require("./clients/noaaSwpcClient");
Object.defineProperty(exports, "NoaaSwpcClient", { enumerable: true, get: function () { return noaaSwpcClient_1.NoaaSwpcClient; } });
const nasaDonkiClient_1 = require("./clients/nasaDonkiClient");
Object.defineProperty(exports, "NasaDonkiClient", { enumerable: true, get: function () { return nasaDonkiClient_1.NasaDonkiClient; } });
const sepPrediction_1 = require("./physics/sepPrediction");
Object.defineProperty(exports, "SepPredictionEngine", { enumerable: true, get: function () { return sepPrediction_1.SepPredictionEngine; } });
const doseCalculator_1 = require("./physics/doseCalculator");
Object.defineProperty(exports, "DoseCalculator", { enumerable: true, get: function () { return doseCalculator_1.DoseCalculator; } });
const mitigationRules_1 = require("./alert/mitigationRules");
Object.defineProperty(exports, "MitigationRulesEngine", { enumerable: true, get: function () { return mitigationRules_1.MitigationRulesEngine; } });
const stormSimulator_1 = require("./simulator/stormSimulator");
Object.defineProperty(exports, "StormSimulator", { enumerable: true, get: function () { return stormSimulator_1.StormSimulator; } });
__exportStar(require("./types"), exports);
class RadiationEngine {
    noaaClient = new noaaSwpcClient_1.NoaaSwpcClient();
    nasaClient = new nasaDonkiClient_1.NasaDonkiClient();
    sepEngine = new sepPrediction_1.SepPredictionEngine();
    doseCalculator = new doseCalculator_1.DoseCalculator();
    mitigationEngine = new mitigationRules_1.MitigationRulesEngine();
    simulator = new stormSimulator_1.StormSimulator();
    activeSimulatedScenario = null;
    /**
     * Obtiene el estado actual del clima espacial y radiación
     * Si hay un escenario de simulación activo, devuelve el estado simulado.
     * De lo contrario, consulta las APIs en vivo de NOAA y NASA.
     */
    async getCurrentState() {
        if (this.activeSimulatedScenario) {
            return this.simulator.getSimulatedState(this.activeSimulatedScenario);
        }
        try {
            const [probabilitiesRes, latestXrayRes, latestProtonsRes] = await Promise.allSettled([
                this.noaaClient.getSolarProbabilities({ strict: true }),
                this.noaaClient.getLatestXrays({ strict: true }),
                this.noaaClient.getLatestProtons({ strict: true })
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
            const nominalFallback = degradedFeeds.length > 0 ? this.simulator.getSimulatedState('NOMINAL') : null;
            const probabilities = probabilitiesRes.status === 'fulfilled' ? probabilitiesRes.value : nominalFallback.probabilities;
            const latestXray = latestXrayRes.status === 'fulfilled' ? latestXrayRes.value : nominalFallback.currentTelemetry.latestXray;
            const latestProtons = latestProtonsRes.status === 'fulfilled' ? latestProtonsRes.value : nominalFallback.currentTelemetry.latestProtons;
            const primaryProtonFlux = latestProtons.find(p => p.energyChannel.includes('10'))?.fluxPfu ?? 0.8;
            const stormScale = this.mitigationEngine.evaluateStormScale(primaryProtonFlux);
            const earlyWarning = this.sepEngine.evaluateEarlyWarning(latestXray);
            const biologicalDoses = this.doseCalculator.getAllShieldingEstimates(primaryProtonFlux);
            const mitigation = this.mitigationEngine.generateProtocol(stormScale);
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
                earlyWarning,
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
     * Activa o desactiva un escenario simulado (ideal para la demo del jurado)
     */
    setSimulationScenario(scenarioId) {
        this.activeSimulatedScenario = scenarioId;
    }
    /**
     * Obtiene los pronósticos de impacto de eyecciones de masa coronal (WSA-ENLIL de NASA DONKI)
     */
    async getCmeForecasts() {
        return this.nasaClient.getLatestCmeAnalyses();
    }
}
exports.RadiationEngine = RadiationEngine;
