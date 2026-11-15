"use strict";
/**
 * @module alert/mitigationRules
 * NOAA Solar Radiation Storm (S0-S5) classification and operational/medical mitigation rule engine.
 *
 * Maps >=10 MeV integral proton flux (pfu) onto the official NOAA S-scale thresholds
 * (10 / 100 / 1,000 / 10,000 / 100,000 pfu) and produces crew flight-rule flags
 * (EVA abort, storm shelter evacuation, external optical sensor shutdown) and clinical
 * countermeasure checklists.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MitigationRulesEngine = void 0;
/**
 * Evaluates NOAA solar radiation storm severity and generates crew mitigation protocols.
 */
class MitigationRulesEngine {
    /**
     * Maps GOES >=10 MeV integral proton flux (pfu) to the official NOAA S1-S5 radiation storm scale.
     *
     * Thresholds: S1 >= 10 pfu, S2 >= 100 pfu, S3 >= 1,000 pfu, S4 >= 10,000 pfu, S5 >= 100,000 pfu.
     *
     * @param fluxPfu - Integral >10 MeV proton flux in particle flux units (protons / cm^2 / s / sr).
     * @returns Classified NOAA radiation storm scale (`S0_NOMINAL` through `S5_EXTREME`).
     */
    evaluateStormScale(fluxPfu) {
        if (fluxPfu >= 100000)
            return 'S5_EXTREME';
        if (fluxPfu >= 10000)
            return 'S4_SEVERE';
        if (fluxPfu >= 1000)
            return 'S3_STRONG';
        if (fluxPfu >= 100)
            return 'S2_MODERATE';
        if (fluxPfu >= 10)
            return 'S1_MINOR';
        return 'S0_NOMINAL';
    }
    /**
     * Generates operational flight rules and clinical radiation countermeasures for a storm scale.
     *
     * @param scale - NOAA radiation storm severity (`S0_NOMINAL` through `S5_EXTREME`).
     * @returns Operational posture flags, medical countermeasures, and crew action checklist.
     */
    generateProtocol(scale) {
        switch (scale) {
            case 'S5_EXTREME':
                return {
                    stormScale: 'S5_EXTREME',
                    abortEvaImmediately: true,
                    evacuateToStormShelter: true,
                    powerDownExternalSensors: true,
                    medicalCountermeasures: [
                        'Immediate administration of radioprotective agents (Antioxidant cocktail + Amifostine analog)',
                        'Administer 5-HT3 receptor antagonists (Ondansetron) for acute radiation nausea',
                        'Continuous active dosimeter monitoring; log personal film badges',
                        'Hydration protocol: minimum 2.5L electrolyte fluid per astronaut / 24h'
                    ],
                    actionChecklist: [
                        'CRITICAL: All crew members must remain inside the central storm shelter',
                        'Surround crew berths with remaining potable water bags and hydrogenated poly-blocks',
                        'Shut down optical and star tracker sensors on module exterior to prevent sensor degradation',
                        'Notify Mission Control Houston & Flight Surgeon of shelter ingress time'
                    ]
                };
            case 'S4_SEVERE':
                return {
                    stormScale: 'S4_SEVERE',
                    abortEvaImmediately: true,
                    evacuateToStormShelter: true,
                    powerDownExternalSensors: true,
                    medicalCountermeasures: [
                        'Administer prophylactic antiemetic to prevent acute motion/radiation sickness',
                        'Oral radioprotector supplement regimen (Vitamins C, E, Selenium, N-acetylcysteine)',
                        'Prepare peripheral blood sample kit for post-event lymphocyte count'
                    ],
                    actionChecklist: [
                        'Abort all EVA operations; depressurize/repressurize airlock on rapid emergency cycle',
                        'Crew ingress to dedicated Storm Shelter within 20 minutes',
                        'Verify radiation alarm acoustic sensors in all habitable compartments',
                        'Log baseline body temperature and blood pressure before shelter lock'
                    ]
                };
            case 'S3_STRONG':
                return {
                    stormScale: 'S3_STRONG',
                    abortEvaImmediately: true,
                    evacuateToStormShelter: false,
                    powerDownExternalSensors: false,
                    medicalCountermeasures: [
                        'Oral hydration and daily antioxidant pack',
                        'Frequent sleep and mood checks; high cognitive load tasks suspended'
                    ],
                    actionChecklist: [
                        'Mandatory termination of any planned extravehicular activity (EVA)',
                        'Crew restricted to standard cabin interior (no cupola or unshielded observation modules)',
                        'Review storm shelter supply readiness in case flux escalates to S4'
                    ]
                };
            case 'S2_MODERATE':
                return {
                    stormScale: 'S2_MODERATE',
                    abortEvaImmediately: false,
                    evacuateToStormShelter: false,
                    powerDownExternalSensors: false,
                    medicalCountermeasures: [
                        'Standard mission multivitamin regimen',
                        'Track cumulative badge dose in mission health log'
                    ],
                    actionChecklist: [
                        'Postpone non-essential EVAs until solar proton flux drops below 50 pfu',
                        'Increase radiation reading telemetry polling to every 15 minutes'
                    ]
                };
            case 'S1_MINOR':
            case 'S0_NOMINAL':
            default:
                return {
                    stormScale: scale,
                    abortEvaImmediately: false,
                    evacuateToStormShelter: false,
                    powerDownExternalSensors: false,
                    medicalCountermeasures: [
                        'Standard daily micronutrient and physical exercise protocol (2.5h ARED/T2)'
                    ],
                    actionChecklist: [
                        'Normal flight operations permitted',
                        'Nominal radiation background monitoring active'
                    ]
                };
        }
    }
}
exports.MitigationRulesEngine = MitigationRulesEngine;
