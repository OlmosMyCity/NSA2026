/**
 * @module alert/mitigationRules
 * NOAA Solar Radiation Storm (S0-S5) classification and operational/medical mitigation rule engine.
 *
 * Maps >=10 MeV integral proton flux (pfu) onto the official NOAA S-scale thresholds
 * (10 / 100 / 1,000 / 10,000 / 100,000 pfu) and produces crew flight-rule flags
 * (EVA abort, storm shelter evacuation, external optical sensor shutdown) and clinical
 * countermeasure checklists.
 */
import { NOAAStormScale, RadiationMitigationProtocol } from '../types';
/**
 * Evaluates NOAA solar radiation storm severity and generates crew mitigation protocols.
 */
export declare class MitigationRulesEngine {
    /**
     * Maps GOES >=10 MeV integral proton flux (pfu) to the official NOAA S1-S5 radiation storm scale.
     *
     * Thresholds: S1 >= 10 pfu, S2 >= 100 pfu, S3 >= 1,000 pfu, S4 >= 10,000 pfu, S5 >= 100,000 pfu.
     *
     * @param fluxPfu - Integral >10 MeV proton flux in particle flux units (protons / cm^2 / s / sr).
     * @returns Classified NOAA radiation storm scale (`S0_NOMINAL` through `S5_EXTREME`).
     */
    evaluateStormScale(fluxPfu: number): NOAAStormScale;
    /**
     * Generates operational flight rules and clinical radiation countermeasures for a storm scale.
     *
     * @param scale - NOAA radiation storm severity (`S0_NOMINAL` through `S5_EXTREME`).
     * @returns Operational posture flags, medical countermeasures, and crew action checklist.
     */
    generateProtocol(scale: NOAAStormScale): RadiationMitigationProtocol;
}
