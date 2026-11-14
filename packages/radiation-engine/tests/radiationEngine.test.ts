import { describe, it, expect, vi, afterEach } from 'vitest';
import { RadiationEngine } from '../src/index';
import { SepPredictionEngine } from '../src/physics/sepPrediction';
import { DoseCalculator } from '../src/physics/doseCalculator';
import { MitigationRulesEngine } from '../src/alert/mitigationRules';
import { StormSimulator } from '../src/simulator/stormSimulator';
import { GOESXrayReading } from '../src/types';

describe('SepPredictionEngine (Relativistic Particle Kinetics)', () => {
  const engine = new SepPredictionEngine();

  it('calculates relativistic speed beta correctly for 100 MeV protons', () => {
    const beta = engine.calculateRelativisticBeta(100);
    // Para 100 MeV, beta es aproximadamente 0.428 (~43% de c)
    expect(beta).toBeGreaterThan(0.40);
    expect(beta).toBeLessThan(0.45);
  });

  it('calculates transit time across Parker spiral correctly', () => {
    // 100 MeV: distancia efectiva por espiral y scattering toma entre 35 y 60 minutos
    const minutes = engine.calculateTransitTimeMinutes(100);
    expect(minutes).toBeGreaterThan(35);
    expect(minutes).toBeLessThan(60);
  });

  it('triggers early warning for a major X-class flare', () => {
    const flareReading: GOESXrayReading = {
      timestamp: new Date().toISOString(),
      satellite: 18,
      fluxShort: 2.5e-5,
      fluxLong: 3.2e-4, // Clase X3.2
      currentClass: 'X3.2',
      derivativePerMinute: 4.0e-5
    };

    const warning = engine.evaluateEarlyWarning(flareReading);
    expect(warning.isWarningActive).toBe(true);
    expect(warning.predictedStormScale).toBe('S3_STRONG');
    expect(warning.estimatedProtonArrivalMinutes).toBeGreaterThan(15);
  });
});

describe('DoseCalculator (Biological Dose & Shielding Attenuation)', () => {
  const calculator = new DoseCalculator();

  it('attenuates radiation effectively in the dedicated Storm Shelter', () => {
    const fluxPfu = 10000; // Tormenta severa S4
    const evaDose = calculator.calculateDoseRateMicroSv(fluxPfu, 'EVA_SUIT');
    const shelterDose = calculator.calculateDoseRateMicroSv(fluxPfu, 'STORM_SHELTER');

    // El Storm Shelter debe reducir la dosis en más del 90%
    const reductionRatio = shelterDose / evaDose;
    expect(reductionRatio).toBeLessThan(0.10);
  });

  it('flags clinical risk level as HAZARDOUS or LETHAL for high unshielded flux', () => {
    const estimate = calculator.calculateBiologicalEstimate(15000, 'EVA_SUIT');
    expect(['HAZARDOUS', 'LETHAL_WITHOUT_SHELTER']).toContain(estimate.clinicalRiskLevel);
  });
});

describe('MitigationRulesEngine', () => {
  const rules = new MitigationRulesEngine();

  it('correctly maps proton flux to NOAA S1-S5 scale', () => {
    expect(rules.evaluateStormScale(5)).toBe('S0_NOMINAL');
    expect(rules.evaluateStormScale(25)).toBe('S1_MINOR');
    expect(rules.evaluateStormScale(150)).toBe('S2_MODERATE');
    expect(rules.evaluateStormScale(2500)).toBe('S3_STRONG');
    expect(rules.evaluateStormScale(15000)).toBe('S4_SEVERE');
  });

  it('requires immediate shelter and EVA abort for S4 severe storm', () => {
    const protocol = rules.generateProtocol('S4_SEVERE');
    expect(protocol.abortEvaImmediately).toBe(true);
    expect(protocol.evacuateToStormShelter).toBe(true);
    expect(protocol.medicalCountermeasures.length).toBeGreaterThan(0);
  });
});

describe('StormSimulator (Demo Scenarios)', () => {
  const simulator = new StormSimulator();

  it('generates a valid FLARE_EARLY_WARNING scenario state', () => {
    const state = simulator.getSimulatedState('FLARE_EARLY_WARNING');
    expect(state.earlyWarning.isWarningActive).toBe(true);
    expect(state.earlyWarning.estimatedProtonArrivalMinutes).toBe(48);
    expect(state.mitigation.abortEvaImmediately).toBe(true);
  });
});

describe('RadiationEngine (Telemetry Degradation)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sets telemetryDegraded=true when NOAA telemetry fails instead of returning silent nominal', async () => {
    const engine = new RadiationEngine();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network offline'));

    const state = await engine.getCurrentState();

    expect(state.telemetryDegraded).toBe(true);
    expect(state.degradationReason).toContain('unavailable');
    expect(state.currentTelemetry.stormScale).toBe('S0_NOMINAL');
  });
});
