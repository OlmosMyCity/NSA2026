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
export class DoseCalculator {
  // Reference habitat shielding models (areal density in g/cm^2 and fractional flux transmission)
  public static readonly SHIELDING_PROPERTIES: Record<ShieldingType, ShieldingProperty> = {
    EVA_SUIT: {
      type: 'EVA_SUIT',
      name: 'Extravehicular Activity (EVA) Spacesuit',
      arealDensityGcm2: 1.2,
      attenuationFactor: 0.95, // Transmits 95% of ionizing particle flux
      description: 'Blindaje mínimo contra radiación ionizante. Máxima vulnerabilidad a protones solares.'
    },
    CREW_CABIN_NOMINAL: {
      type: 'CREW_CABIN_NOMINAL',
      name: 'Orion / Gateway Cabin Nominal Shielding',
      arealDensityGcm2: 10.0,
      attenuationFactor: 0.25, // Transmits 25% of ionizing particle flux (75% attenuation)
      description: 'Estructura de aleación de aluminio y polímeros del hábitat de vuelo nominal.'
    },
    STORM_SHELTER: {
      type: 'STORM_SHELTER',
      name: 'Dedicated Crew Solar Storm Shelter',
      arealDensityGcm2: 25.0,
      attenuationFactor: 0.04, // Transmits 4% of ionizing particle flux (96% attenuation)
      description: 'Zona central del módulo blindada con reservas de agua, víveres y paneles de polietileno hidrogenado.'
    }
  };

  // Deep-space Galactic Cosmic Ray (GCR) background dose rate baseline: 1.8 uSv/h (~0.043 mSv/day)
  private readonly BACKGROUND_GCR_RATE_MICRO_SV = 1.8;

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
  calculateDoseRateMicroSv(fluxPfu: number, shielding: ShieldingType): number {
    const properties = DoseCalculator.SHIELDING_PROPERTIES[shielding];
    const rawProtonDoseRate = fluxPfu * 2.5; // µSv/h
    const attenuatedProtonDoseRate = rawProtonDoseRate * properties.attenuationFactor;
    return this.BACKGROUND_GCR_RATE_MICRO_SV + attenuatedProtonDoseRate;
  }

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
  calculateBiologicalEstimate(fluxPfu: number, shielding: ShieldingType): BiologicalDoseEstimate {
    const doseRate = this.calculateDoseRateMicroSv(fluxPfu, shielding);
    
    // Project 30-day dose integrating peak storm flux (18-24 h) plus 30-day GCR background
    const stormDurationHours = Math.min(24, Math.max(6, fluxPfu > 1000 ? 36 : 18));
    const stormDoseMsv = (doseRate * stormDurationHours) / 1000;
    const background30DayDoseMsv = (this.BACKGROUND_GCR_RATE_MICRO_SV * 24 * 30) / 1000;
    const projected30DayDoseMsv = Number((stormDoseMsv + background30DayDoseMsv).toFixed(2));

    // NASA-STD-3001 reference limit: 500 mSv career/annual benchmark
    const careerPercentage = Number(((projected30DayDoseMsv / 500) * 100).toFixed(1));

    let riskLevel: BiologicalDoseEstimate['clinicalRiskLevel'] = 'NOMINAL';
    if (projected30DayDoseMsv > 1000) {
      riskLevel = 'LETHAL_WITHOUT_SHELTER';
    } else if (projected30DayDoseMsv > 250) {
      riskLevel = 'HAZARDOUS';
    } else if (projected30DayDoseMsv > 50) {
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
   * Computes comparative biological dose estimates across all three shielding configurations.
   *
   * @param fluxPfu - Integral >10 MeV proton flux in pfu.
   * @returns Map of shielding tier to biological dose estimate.
   */
  getAllShieldingEstimates(fluxPfu: number): Record<ShieldingType, BiologicalDoseEstimate> {
    return {
      EVA_SUIT: this.calculateBiologicalEstimate(fluxPfu, 'EVA_SUIT'),
      CREW_CABIN_NOMINAL: this.calculateBiologicalEstimate(fluxPfu, 'CREW_CABIN_NOMINAL'),
      STORM_SHELTER: this.calculateBiologicalEstimate(fluxPfu, 'STORM_SHELTER')
    };
  }
}
