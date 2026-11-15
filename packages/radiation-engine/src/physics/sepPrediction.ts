/**
 * @module physics/sepPrediction
 * Relativistic Solar Energetic Particle (SEP) transit-time and flare early-warning model.
 *
 * Computes relativistic proton velocities (MeV -> beta = v/c), effective interplanetary
 * travel time along the curved Parker spiral (in AU) with pitch-angle scattering, and
 * operational early-warning lead times from GOES soft X-ray precursors (W/m^2).
 */

import { GOESXrayReading, EarlyWarningWindow, NOAAStormScale } from '../types';

/**
 * Predicts SEP proton arrival lead times and NOAA storm severity from GOES X-ray flare telemetry.
 */
export class SepPredictionEngine {
  // Physical constants
  private readonly SPEED_OF_LIGHT = 299792.458; // km/s
  private readonly PROTON_REST_MASS_MEV = 938.272; // MeV (m_p * c^2)
  private readonly AU_KM = 149597870.7; // 1 Astronomical Unit (AU) in km

  /**
   * Computes the relativistic speed fraction beta = v / c for a proton of kinetic energy E (MeV).
   *
   * Uses the Lorentz factor gamma = 1 + E / (m_p * c^2) and beta = sqrt(1 - 1 / gamma^2).
   *
   * @param energyMev - Proton kinetic energy in MeV.
   * @returns Dimensionless relativistic velocity fraction beta (0 to <1).
   */
  calculateRelativisticBeta(energyMev: number): number {
    const gamma = 1 + energyMev / this.PROTON_REST_MASS_MEV;
    const beta = Math.sqrt(1 - 1 / (gamma * gamma));
    return beta;
  }

  /**
   * Computes interplanetary proton transit time along the Parker spiral in minutes.
   *
   * Accounts for curved IMF field-line geometry (~1.2 to 1.3 AU nominal path length from Sun
   * to 1 AU) and interplanetary pitch-angle scattering / diffusion (1.8x to 2.5x effective path
   * delay for peak flux arrival).
   *
   * @param energyMev - Proton kinetic energy in MeV.
   * @param parkerLengthAu - Magnetic field-line path length from Sun to target in AU (default 1.25 AU).
   * @param scatteringFactor - Dimensionless diffusive transport delay multiplier (default 2.0).
   * @returns Estimated proton transit time in minutes.
   */
  calculateTransitTimeMinutes(energyMev: number, parkerLengthAu = 1.25, scatteringFactor = 2.0): number {
    const beta = this.calculateRelativisticBeta(energyMev);
    const speedKmS = beta * this.SPEED_OF_LIGHT;
    const directDistanceKm = parkerLengthAu * this.AU_KM;
    const effectiveDistanceKm = directDistanceKm * scatteringFactor;
    const transitSeconds = effectiveDistanceKm / speedKmS;
    return transitSeconds / 60;
  }

  /**
   * Evaluates whether a GOES 0.1-0.8 nm X-ray reading triggers an SEP early-warning window.
   *
   * Triggers on major flares (>= M5, flux >= 5e-5 W/m^2) or impulsive M2+ rises
   * (flux >= 2e-5 W/m^2 and dF/dt > 5e-6 W/m^2/min). Available warning lead time equals the
   * 100 MeV proton transit time minus the 8.32-minute electromagnetic X-ray travel time across 1 AU,
   * floored at 20 minutes.
   *
   * @param latestXray - Most recent GOES X-ray reading, or null if unavailable.
   * @returns Early-warning window state, lead time in minutes, and projected NOAA S-scale.
   */
  evaluateEarlyWarning(latestXray: GOESXrayReading | null): EarlyWarningWindow {
    if (!latestXray) {
      return {
        isWarningActive: false,
        triggerEvent: null,
        flareOnsetTimestamp: null,
        estimatedProtonArrivalMinutes: null,
        estimatedPeakFluxPfu: null,
        predictedStormScale: 'S0_NOMINAL',
        confidenceScore: 0.0
      };
    }

    const flux = latestXray.fluxLong;
    const dFdt = latestXray.derivativePerMinute;

    // Trigger threshold: M5+ flare (>= 5e-5 W/m^2) or rapid impulsive rise (>= 2e-5 W/m^2)
    const isMajorFlare = flux >= 5e-5;
    const isViolentRise = flux >= 2e-5 && dFdt > 5e-6;

    if (!isMajorFlare && !isViolentRise) {
      return {
        isWarningActive: false,
        triggerEvent: null,
        flareOnsetTimestamp: null,
        estimatedProtonArrivalMinutes: null,
        estimatedPeakFluxPfu: null,
        predictedStormScale: 'S0_NOMINAL',
        confidenceScore: 0.1
      };
    }

    // Biologically hazardous solar proton benchmark: 50 to 100 MeV
    const transitTime100Mev = this.calculateTransitTimeMinutes(100); // ~48 minutes
    const lightTravelTimeMinutes = 8.32; // Electromagnetic 1 AU transit time of flare X-rays

    // Usable crew-mitigation lead time after X-ray flare detection
    const warningLeadTimeMinutes = Math.max(20, Math.round(transitTime100Mev - lightTravelTimeMinutes));

    // Map peak long-channel X-ray flux (W/m^2) to projected NOAA S-scale and peak >=10 MeV pfu
    let predictedStormScale: NOAAStormScale = 'S1_MINOR';
    let estimatedPeakFluxPfu = 15;

    if (flux >= 5e-4) { // Flare >= X5
      predictedStormScale = 'S4_SEVERE';
      estimatedPeakFluxPfu = 12000;
    } else if (flux >= 1e-4) { // Flare X1 - X4
      predictedStormScale = 'S3_STRONG';
      estimatedPeakFluxPfu = 2500;
    } else if (flux >= 5e-5) { // Flare M5 - M9
      predictedStormScale = 'S2_MODERATE';
      estimatedPeakFluxPfu = 250;
    }

    return {
      isWarningActive: true,
      triggerEvent: `High-Energy Solar Flare (${latestXray.currentClass}) detected by GOES-${latestXray.satellite}`,
      flareOnsetTimestamp: latestXray.timestamp,
      estimatedProtonArrivalMinutes: warningLeadTimeMinutes,
      estimatedPeakFluxPfu: estimatedPeakFluxPfu,
      predictedStormScale: predictedStormScale,
      confidenceScore: flux >= 1e-4 ? 0.88 : 0.72
    };
  }
}
