/**
 * @module physics/doseCalculator
 * Biological dose-rate and cumulative exposure calculator for deep-space habitats.
 *
 * Converts GOES >10 MeV integral proton flux (pfu) into shielded effective dose rates (uSv/h),
 * projects 30-day cumulative event doses (mSv), and evaluates clinical risk against
 * NASA-STD-3001 career/annual reference limits (500 mSv) across three shielding areal densities
 * (1.2, 10.0, and 25.0 g/cm^2).
 */
import { ShieldingType, ShieldingProperty, BiologicalDoseEstimate } from '../types';
/**
 * Estimates ionizing radiation dose rates and NASA-STD-3001 clinical risk tiers across shielding levels.
 */
export declare class DoseCalculator {
    static readonly SHIELDING_PROPERTIES: Record<ShieldingType, ShieldingProperty>;
    private readonly BACKGROUND_GCR_RATE_MICRO_SV;
    /**
     * Converts integral solar proton flux (>10 MeV, in pfu) into shielded effective dose rate (uSv/h).
     *
     * Uses a deep-space unshielded solar-spectrum conversion of 2.5 uSv/h per pfu, scales by the
     * shielding tier's transmission factor, and adds the constant 1.8 uSv/h GCR background rate.
     *
     * @param fluxPfu - Integral >10 MeV proton flux in particle flux units (protons / cm^2 / s / sr).
     * @param shielding - Target habitat/suit shielding tier.
     * @returns Total shielded effective dose rate in uSv/h.
     */
    calculateDoseRateMicroSv(fluxPfu: number, shielding: ShieldingType): number;
    /**
     * Computes full biological dose rate, 30-day cumulative projection, and NASA-STD-3001 risk tier.
     *
     * Projects 30-day cumulative dose (mSv) by integrating storm-level exposure over an effective
     * peak duration (18 h nominal, 24 h cap for >1000 pfu events) plus 30 days of GCR background,
     * and classifies clinical risk against thresholds at 50, 250, and 1000 mSv relative to the
     * 500 mSv NASA-STD-3001 reference benchmark.
     *
     * @param fluxPfu - Integral >10 MeV proton flux in pfu.
     * @param shielding - Target habitat/suit shielding tier.
     * @returns Structured biological dose and risk assessment.
     */
    calculateBiologicalEstimate(fluxPfu: number, shielding: ShieldingType): BiologicalDoseEstimate;
    /**
     * Computes comparative biological dose estimates across all three shielding configurations.
     *
     * @param fluxPfu - Integral >10 MeV proton flux in pfu.
     * @returns Map of shielding tier to biological dose estimate.
     */
    getAllShieldingEstimates(fluxPfu: number): Record<ShieldingType, BiologicalDoseEstimate>;
}
