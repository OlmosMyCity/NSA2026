"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StormSimulator = void 0;
const doseCalculator_1 = require("../physics/doseCalculator");
const sepPrediction_1 = require("../physics/sepPrediction");
const mitigationRules_1 = require("../alert/mitigationRules");
class StormSimulator {
    doseCalculator = new doseCalculator_1.DoseCalculator();
    sepEngine = new sepPrediction_1.SepPredictionEngine();
    mitigationEngine = new mitigationRules_1.MitigationRulesEngine();
    /**
     * Genera el estado completo del motor según el escenario de simulación seleccionado
     */
    getSimulatedState(scenarioId) {
        const now = new Date().toISOString();
        switch (scenarioId) {
            case 'FLARE_EARLY_WARNING': {
                // Escenario: Fulguración masiva Clase X4.5 detectada.
                // Aún no llegan los protones (flujo bajo en pfu), pero la ventana de alerta temprana está activa con 48 min de anticipación.
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 4.8e-5,
                    fluxLong: 4.5e-4, // Clase X4.5
                    currentClass: 'X4.5',
                    derivativePerMinute: 8.5e-5 // Subida vertiginosa
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 4.2 },
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 0.8 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 0.1 }
                ];
                const earlyWarning = this.sepEngine.evaluateEarlyWarning(xray);
                // Ajustar tiempo específico del escenario para la demo
                earlyWarning.estimatedProtonArrivalMinutes = 48;
                earlyWarning.predictedStormScale = 'S4_SEVERE';
                const stormScale = 'S0_NOMINAL'; // Aún no impactan
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol('S4_SEVERE');
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'FLARE_EARLY_WARNING (X4.5 Solar Flare Detected - Early Warning Countdown Active)',
                    probabilities: this.getProbabilitiesForStorm(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: stormScale
                    },
                    earlyWarning: earlyWarning,
                    biologicalDoses: doses,
                    mitigation: mitigation
                };
            }
            case 'PEAK_STORM_S4': {
                // Escenario: El pico de protones ha impactado la nave (14,500 pfu, Tormenta S4 Severa)
                const xray = {
                    timestamp: now,
                    satellite: 18,
                    fluxShort: 2.1e-5,
                    fluxLong: 1.8e-4,
                    currentClass: 'X1.8',
                    derivativePerMinute: -1.2e-6 // Meseta / declive
                };
                const protons = [
                    { timestamp: now, energyChannel: '>=10 MeV', fluxPfu: 14500 }, // S4
                    { timestamp: now, energyChannel: '>=50 MeV', fluxPfu: 3200 },
                    { timestamp: now, energyChannel: '>=100 MeV', fluxPfu: 840 }
                ];
                const stormScale = 'S4_SEVERE';
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol(stormScale);
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'PEAK_STORM_S4 (Extreme SPE Flux Active - Mandatory Shelter)',
                    probabilities: this.getProbabilitiesForStorm(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: stormScale
                    },
                    earlyWarning: {
                        isWarningActive: false,
                        triggerEvent: 'Solar Particle Event (S4) Peak Flux In Progress',
                        flareOnsetTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                        estimatedProtonArrivalMinutes: 0,
                        estimatedPeakFluxPfu: 14500,
                        predictedStormScale: 'S4_SEVERE',
                        confidenceScore: 1.0
                    },
                    biologicalDoses: doses,
                    mitigation: mitigation
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
                const doses = this.doseCalculator.getAllShieldingEstimates(protons[0].fluxPfu);
                const mitigation = this.mitigationEngine.generateProtocol('S0_NOMINAL');
                return {
                    timestamp: now,
                    isSimulated: true,
                    activeScenario: 'NOMINAL (Quiet Solar Conditions)',
                    probabilities: this.getProbabilitiesNominal(),
                    currentTelemetry: {
                        latestXray: xray,
                        latestProtons: protons,
                        stormScale: 'S0_NOMINAL'
                    },
                    earlyWarning: {
                        isWarningActive: false,
                        triggerEvent: null,
                        flareOnsetTimestamp: null,
                        estimatedProtonArrivalMinutes: null,
                        estimatedPeakFluxPfu: null,
                        predictedStormScale: 'S0_NOMINAL',
                        confidenceScore: 0.05
                    },
                    biologicalDoses: doses,
                    mitigation: mitigation
                };
            }
        }
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
