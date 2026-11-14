"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoseCalculator = void 0;
class DoseCalculator {
    // Modelos de blindaje (Areal density en g/cm² y factor de atenuación)
    static SHIELDING_PROPERTIES = {
        EVA_SUIT: {
            type: 'EVA_SUIT',
            name: 'Extravehicular Activity (EVA) Spacesuit',
            arealDensityGcm2: 1.2,
            attenuationFactor: 0.95, // Deja pasar el 95% del flujo ionizante
            description: 'Blindaje mínimo contra radiación ionizante. Máxima vulnerabilidad a protones solares.'
        },
        CREW_CABIN_NOMINAL: {
            type: 'CREW_CABIN_NOMINAL',
            name: 'Orion / Gateway Cabin Nominal Shielding',
            arealDensityGcm2: 10.0,
            attenuationFactor: 0.25, // Reduce el flujo al 25%
            description: 'Estructura de aleación de aluminio y polímeros del hábitat de vuelo nominal.'
        },
        STORM_SHELTER: {
            type: 'STORM_SHELTER',
            name: 'Dedicated Crew Solar Storm Shelter',
            arealDensityGcm2: 25.0,
            attenuationFactor: 0.04, // Reduce el flujo al 4% (96% de atenuación)
            description: 'Zona central del módulo blindada con reservas de agua, víveres y paneles de polietileno hidrogenado.'
        }
    };
    // Radiación cósmica galáctica de fondo (GCR) promedio en espacio profundo: ~1.5 µSv/h (~0.036 mSv/día)
    BACKGROUND_GCR_RATE_MICRO_SV = 1.8;
    /**
     * Convierte flujo de protones (pfu para E > 10 MeV) a tasa de dosis absorbida efectiva (µSv/h)
     * En espacio profundo, 1 pfu equivale aproximadamente a 2.5 µSv/h sin blindaje para un espectro solar estándar.
     */
    calculateDoseRateMicroSv(fluxPfu, shielding) {
        const properties = DoseCalculator.SHIELDING_PROPERTIES[shielding];
        const rawProtonDoseRate = fluxPfu * 2.5; // µSv/h
        const attenuatedProtonDoseRate = rawProtonDoseRate * properties.attenuationFactor;
        return this.BACKGROUND_GCR_RATE_MICRO_SV + attenuatedProtonDoseRate;
    }
    /**
     * Genera el desglose completo de dosis biológica y riesgo para un nivel de flujo dado
     */
    calculateBiologicalEstimate(fluxPfu, shielding) {
        const doseRate = this.calculateDoseRateMicroSv(fluxPfu, shielding);
        // Proyección de dosis a 30 días asumiendo este nivel durante 24 horas y luego fondo GCR
        // (un evento solar típico dura entre 24 y 48 horas)
        const stormDurationHours = Math.min(24, Math.max(6, fluxPfu > 1000 ? 36 : 18));
        const stormDoseMsv = (doseRate * stormDurationHours) / 1000;
        const background30DayDoseMsv = (this.BACKGROUND_GCR_RATE_MICRO_SV * 24 * 30) / 1000;
        const projected30DayDoseMsv = Number((stormDoseMsv + background30DayDoseMsv).toFixed(2));
        // Estándar NASA-STD-3001: Límite anual/carrera de referencia = 500 mSv
        const careerPercentage = Number(((projected30DayDoseMsv / 500) * 100).toFixed(1));
        let riskLevel = 'NOMINAL';
        if (projected30DayDoseMsv > 1000) {
            riskLevel = 'LETHAL_WITHOUT_SHELTER';
        }
        else if (projected30DayDoseMsv > 250) {
            riskLevel = 'HAZARDOUS';
        }
        else if (projected30DayDoseMsv > 50) {
            riskLevel = 'ELEVATED';
        }
        return {
            shieldingType: shielding,
            doseRateMicroSvPerHour: Number(doseRate.toFixed(2)),
            projected30DayDoseMsv: projected30DayDoseMsv,
            careerDosePercentage: careerPercentage,
            clinicalRiskLevel: riskLevel
        };
    }
    /**
     * Genera las estimaciones comparativas para los 3 entornos
     */
    getAllShieldingEstimates(fluxPfu) {
        return {
            EVA_SUIT: this.calculateBiologicalEstimate(fluxPfu, 'EVA_SUIT'),
            CREW_CABIN_NOMINAL: this.calculateBiologicalEstimate(fluxPfu, 'CREW_CABIN_NOMINAL'),
            STORM_SHELTER: this.calculateBiologicalEstimate(fluxPfu, 'STORM_SHELTER')
        };
    }
}
exports.DoseCalculator = DoseCalculator;
