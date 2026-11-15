"use strict";
/**
 * @module simulator/stormSimulator
 * Deterministic solar storm and cislunar radiation scenario simulator.
 *
 * Generates synthetic GOES X-ray/proton telemetry and L1 solar wind conditions across preset
 * mission scenarios (`NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, `SIDE_MISS_CME`) as
 * well as custom Stonyhurst heliographic flare/CME events, feeding the physics, impact,
 * dosimetry, and mitigation engines identically to live telemetry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StormSimulator = void 0;
const noaaSwpcClient_1 = require("../clients/noaaSwpcClient");
const doseCalculator_1 = require("../physics/doseCalculator");
const sepPrediction_1 = require("../physics/sepPrediction");
const solarWindImpact_1 = require("../physics/solarWindImpact");
const mitigationRules_1 = require("../alert/mitigationRules");
/**
 * Produces complete, physically consistent `RadiationEngineState` snapshots for preset
 * and custom solar storm scenarios.
 */
class StormSimulator {
    doseCalculator = new doseCalculator_1.DoseCalculator();
    sepEngine = new sepPrediction_1.SepPredictionEngine();
    impactPredictor = new solarWindImpact_1.SolarWindImpactPredictor();
    mitigationEngine = new mitigationRules_1.MitigationRulesEngine();
    /**
     * Generates a complete radiation engine state snapshot for the selected preset scenario.
     *
     * @param scenarioId - Preset scenario identifier (`NOMINAL`, `FLARE_EARLY_WARNING`, `PEAK_STORM_S4`, or `SIDE_MISS_CME`).
     * @returns Complete simulated `RadiationEngineState` with `isSimulated: true`.
     */
    getSimulatedState(scenarioId) {
        const now = new Date().toISOString();
        switch (scenarioId) {
            case 'FLARE_EARLY_WARNING': {
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 4.8e-5,
                    fluxLong: 4.5e-4, // X4.5-class solar flare flux (W/m^2)
                    currentClass: 'X4.5',
                    derivativePerMinute: 8.5e-5
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 4.2 },
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 0.8 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 0.1 }
                ];
                const solarWind = (0, noaaSwpcClient_1.computeSolarWindMetrics)({
                    timestamp: now,
                    speedKmS: 680,
                    densityPcm3: 14.5,
                    temperatureK: 240000,
                    btNt: 16.2,
                    bzNt: -11.4
                });
                const earlyWarning = this.sepEngine.evaluateEarlyWarning(xray);
                earlyWarning.estimatedProtonArrivalMinutes = 48;
                earlyWarning.predictedStormScale = 'S4_SEVERE';
                const impactPrediction = this.impactPredictor.predictImpact({
                    sourceLocation: 'N14W42',
                    coneHalfAngleDeg: 52,
                    cmeSpeedKmS: 1450,
                    solarWind,
                    predictedStormScale: 'S4_SEVERE',
                    sepArrivalMinutes: 48,
                    moonPhaseAngleDeg: 95
                });
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol('S4_SEVERE');
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'FLARE_EARLY_WARNING (X4.5 Solar Flare @ N14W42 - Early Warning Countdown Active)',
                    probabilities: this.getProbabilitiesForStorm(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: 'S0_NOMINAL'
                    },
                    solarWind,
                    earlyWarning,
                    impactPrediction,
                    biologicalDoses: doses,
                    mitigation
                };
            }
            case 'PEAK_STORM_S4': {
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 2.1e-5,
                    fluxLong: 1.8e-4,
                    currentClass: 'X1.8',
                    derivativePerMinute: -1.2e-6
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 14500 },
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 3200 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 840 }
                ];
                const solarWind = (0, noaaSwpcClient_1.computeSolarWindMetrics)({
                    timestamp: now,
                    speedKmS: 1120,
                    densityPcm3: 28.0,
                    temperatureK: 520000,
                    btNt: 32.0,
                    bzNt: -24.5
                });
                const impactPrediction = this.impactPredictor.predictImpact({
                    sourceLocation: 'S08W32',
                    coneHalfAngleDeg: 60,
                    cmeSpeedKmS: 1650,
                    solarWind,
                    predictedStormScale: 'S4_SEVERE',
                    sepArrivalMinutes: 0,
                    moonPhaseAngleDeg: 110
                });
                const stormScale = 'S4_SEVERE';
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol(stormScale);
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'PEAK_STORM_S4 (Extreme SPE & Solar Wind Shock Active - Mandatory Shelter)',
                    probabilities: this.getProbabilitiesForStorm(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale
                    },
                    solarWind,
                    earlyWarning: {
                        isWarningActive: false,
                        triggerEvent: 'Solar Particle Event (S4) Peak Flux In Progress',
                        flareOnsetTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                        estimatedProtonArrivalMinutes: 0,
                        estimatedPeakFluxPfu: 14500,
                        predictedStormScale: 'S4_SEVERE',
                        confidenceScore: 1.0
                    },
                    impactPrediction,
                    biologicalDoses: doses,
                    mitigation
                };
            }
            case 'SIDE_MISS_CME': {
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 3.1e-5,
                    fluxLong: 2.5e-4,
                    currentClass: 'X2.5',
                    derivativePerMinute: 4.2e-5
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 1.1 },
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 0.12 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 0.02 }
                ];
                const solarWind = (0, noaaSwpcClient_1.computeSolarWindMetrics)({
                    timestamp: now,
                    speedKmS: 460,
                    densityPcm3: 6.0,
                    temperatureK: 110000,
                    btNt: 6.2,
                    bzNt: -2.0
                });
                const impactPrediction = this.impactPredictor.predictImpact({
                    sourceLocation: 'S18E72',
                    coneHalfAngleDeg: 34,
                    cmeSpeedKmS: 1200,
                    solarWind,
                    predictedStormScale: 'S0_NOMINAL',
                    sepArrivalMinutes: null,
                    moonPhaseAngleDeg: 90
                });
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol('S0_NOMINAL');
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'SIDE_MISS_CME (X2.5 East-Limb Flare @ S18E72 - Trajectory Misses Cislunar)',
                    probabilities: this.getProbabilitiesNominal(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: 'S0_NOMINAL'
                    },
                    solarWind,
                    earlyWarning: {
                        isWarningActive: false,
                        triggerEvent: 'X2.5 East-Limb CME (S18E72) - Projected Deep Space Miss',
                        flareOnsetTimestamp: now,
                        estimatedProtonArrivalMinutes: null,
                        estimatedPeakFluxPfu: 15,
                        predictedStormScale: 'S0_NOMINAL',
                        confidenceScore: 0.85
                    },
                    impactPrediction,
                    biologicalDoses: doses,
                    mitigation
                };
            }
            case 'NOMINAL':
            default: {
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 1.1e-8,
                    fluxLong: 5.2e-7,
                    currentClass: 'C1.1',
                    derivativePerMinute: 0.0
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 0.6 },
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 0.05 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 0.01 }
                ];
                const solarWind = (0, noaaSwpcClient_1.computeSolarWindMetrics)({
                    timestamp: now,
                    speedKmS: 410,
                    densityPcm3: 4.8,
                    temperatureK: 92000,
                    btNt: 5.1,
                    bzNt: -1.2
                });
                const impactPrediction = this.impactPredictor.predictImpact({
                    sourceLocation: 'N05W12',
                    coneHalfAngleDeg: 25,
                    cmeSpeedKmS: 410,
                    solarWind,
                    predictedStormScale: 'S0_NOMINAL',
                    sepArrivalMinutes: null,
                    moonPhaseAngleDeg: 90
                });
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol('S0_NOMINAL');
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'NOMINAL (Quiet Solar Wind Conditions)',
                    probabilities: this.getProbabilitiesNominal(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: 'S0_NOMINAL'
                    },
                    solarWind,
                    earlyWarning: {
                        isWarningActive: false,
                        triggerEvent: null,
                        flareOnsetTimestamp: null,
                        estimatedProtonArrivalMinutes: null,
                        estimatedPeakFluxPfu: null,
                        predictedStormScale: 'S0_NOMINAL',
                        confidenceScore: 0.05
                    },
                    impactPrediction,
                    biologicalDoses: doses,
                    mitigation
                };
            }
        }
    }
    /**
     * Simulates a custom solar flare/CME event originating from a Stonyhurst heliographic coordinate
     * (e.g., `"N15W45"` or `"S20E70"`), evaluating cislunar impact trajectory, proton flux escalation,
     * biological shielding doses, and mitigation posture.
     *
     * @param params - Custom heliographic source, flare class, CME/solar wind kinematics, and lunar phase.
     * @returns Complete simulated `RadiationEngineState` for the custom eruption.
     */
    simulateCustomEvent(params) {
        const now = new Date().toISOString();
        const flareClass = params.flareClass ?? 'X';
        const fluxLong = flareClass === 'X' ? 2.8e-4 : flareClass === 'M' ? 6.0e-5 : 3.0e-6;
        const currentClass = flareClass === 'X' ? 'X2.8' : flareClass === 'M' ? 'M6.0' : 'C3.0';
        const xray = {
            timestamp: now,
            satellite: 18,
            fluxShort: fluxLong * 0.12,
            fluxLong,
            currentClass,
            derivativePerMinute: fluxLong * 0.15
        };
        const solarWind = (0, noaaSwpcClient_1.computeSolarWindMetrics)({
            timestamp: now,
            speedKmS: params.solarWindSpeedKmS ?? (flareClass === 'X' ? 780 : 520),
            densityPcm3: params.densityPcm3 ?? (flareClass === 'X' ? 16 : 8),
            temperatureK: 220000,
            btNt: 18,
            bzNt: params.bzNt ?? (flareClass === 'X' ? -14 : -5)
        });
        const earlyWarning = this.sepEngine.evaluateEarlyWarning(xray);
        const impactPrediction = this.impactPredictor.predictImpact({
            sourceLocation: params.sourceLocation,
            coneHalfAngleDeg: params.halfAngleDeg ?? (flareClass === 'X' ? 48 : 35),
            cmeSpeedKmS: params.cmeSpeedKmS ?? (flareClass === 'X' ? 1350 : 750),
            solarWind,
            predictedStormScale: earlyWarning.predictedStormScale,
            sepArrivalMinutes: earlyWarning.estimatedProtonArrivalMinutes,
            moonPhaseAngleDeg: params.moonPhaseAngleDeg ?? 90
        });
        const isDirectOrGlancing = impactPrediction.primaryImpactZone !== 'DEEP_SPACE_MISS';
        if (!isDirectOrGlancing) {
            earlyWarning.isWarningActive = false;
            earlyWarning.predictedStormScale = 'S0_NOMINAL';
        }
        const activeFluxPfu = isDirectOrGlancing && flareClass === 'X' ? 120 : 1.5;
        const protons = [
            { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: activeFluxPfu },
            { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: activeFluxPfu * 0.2 },
            { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: activeFluxPfu * 0.04 }
        ];
        const stormScale = this.mitigationEngine.evaluateStormScale(activeFluxPfu);
        const doses = this.doseCalculator.getAllShieldingEstimates(activeFluxPfu);
        const mitigation = this.mitigationEngine.generateProtocol(isDirectOrGlancing ? earlyWarning.predictedStormScale : 'S0_NOMINAL');
        return {
            timestamp: now,
            isSimulated: true,
            activeScenario: `CUSTOM (${currentClass} @ ${impactPrediction.sourceLocation} -> ${impactPrediction.primaryImpactZone})`,
            probabilities: isDirectOrGlancing ? this.getProbabilitiesForStorm() : this.getProbabilitiesNominal(),
            currentTelemetry: {
                latestXray: xray,
                latestProtons: protons,
                stormScale
            },
            solarWind,
            earlyWarning,
            impactPrediction,
            biologicalDoses: doses,
            mitigation
        };
    }
    getProbabilitiesForStorm() {
        return [
            {
                date: new Date().toISOString(),
                cClass1DayPct: 99,
                cClass2DayPct: 99,
                cClass3DayPct: 95,
                mClass1DayPct: 85,
                mClass2DayPct: 80,
                mClass3DayPct: 75,
                xClass1DayPct: 45,
                xClass2DayPct: 40,
                xClass3DayPct: 35,
                protonEvent1DayPct: 80,
                protonEvent2DayPct: 70,
                protonEvent3DayPct: 60,
                polarCapAbsorption: 'red'
            }
        ];
    }
    getProbabilitiesNominal() {
        return [
            {
                date: new Date().toISOString(),
                cClass1DayPct: 60,
                cClass2DayPct: 55,
                cClass3DayPct: 50,
                mClass1DayPct: 15,
                mClass2DayPct: 10,
                mClass3DayPct: 10,
                xClass1DayPct: 1,
                xClass2DayPct: 1,
                xClass3DayPct: 1,
                protonEvent1DayPct: 1,
                protonEvent2DayPct: 1,
                protonEvent3DayPct: 1,
                polarCapAbsorption: 'green'
            }
        ];
    }
}
exports.StormSimulator = StormSimulator;
