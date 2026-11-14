import { ShieldingType, ShieldingProperty, BiologicalDoseEstimate } from '../types';
export declare class DoseCalculator {
    static readonly SHIELDING_PROPERTIES: Record<ShieldingType, ShieldingProperty>;
    private readonly BACKGROUND_GCR_RATE_MICRO_SV;
    /**
     * Convierte flujo de protones (pfu para E > 10 MeV) a tasa de dosis absorbida efectiva (µSv/h)
     * En espacio profundo, 1 pfu equivale aproximadamente a 2.5 µSv/h sin blindaje para un espectro solar estándar.
     */
    calculateDoseRateMicroSv(fluxPfu: number, shielding: ShieldingType): number;
    /**
     * Genera el desglose completo de dosis biológica y riesgo para un nivel de flujo dado
     */
    calculateBiologicalEstimate(fluxPfu: number, shielding: ShieldingType): BiologicalDoseEstimate;
    /**
     * Genera las estimaciones comparativas para los 3 entornos
     */
    getAllShieldingEstimates(fluxPfu: number): Record<ShieldingType, BiologicalDoseEstimate>;
}
