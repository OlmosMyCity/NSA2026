import { describe, it, expect, vi, afterEach } from 'vitest';
import { RadiationEngine } from '../src/index';
import { SepPredictionEngine } from '../src/physics/sepPrediction';
import { SolarWindImpactPredictor } from '../src/physics/solarWindImpact';
import { DoseCalculator } from '../src/physics/doseCalculator';
import { MitigationRulesEngine } from '../src/alert/mitigationRules';
import { StormSimulator } from '../src/simulator/stormSimulator';
import { computeSolarWindMetrics } from '../src/clients/noaaSwpcClient';
import { RadiationEngine } from '../src/index';
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
    expect(state.solarWind.speedKmS).toBeGreaterThan(600);
    expect(state.impactPrediction.primaryImpactZone).toBe('CISLUNAR_AND_EARTH_DIRECT');
  });

  it('generates a SIDE_MISS_CME scenario where East-limb CME misses Earth and Moon', () => {
    const state = simulator.getSimulatedState('SIDE_MISS_CME');
    expect(state.impactPrediction.primaryImpactZone).toBe('DEEP_SPACE_MISS');
    expect(state.mitigation.abortEvaImmediately).toBe(false);
    expect(state.impactPrediction.targets.every((t) => t.status === 'MISS')).toBe(true);
  });

  it('supports custom heliographic flare/CME simulation', () => {
    const direct = simulator.simulateCustomEvent({
      sourceLocation: 'N10W45',
      flareClass: 'X',
      cmeSpeedKmS: 1400,
      halfAngleDeg: 50
    });
    expect(direct.impactPrediction.primaryImpactZone).toBe('CISLUNAR_AND_EARTH_DIRECT');

    const miss = simulator.simulateCustomEvent({
      sourceLocation: 'S22E80',
      flareClass: 'X',
      cmeSpeedKmS: 1400,
      halfAngleDeg: 35
    });
    expect(miss.impactPrediction.primaryImpactZone).toBe('DEEP_SPACE_MISS');
  });
});

describe('SolarWindImpactPredictor (Target & Parker Spiral Prediction)', () => {
  const predictor = new SolarWindImpactPredictor();

  it('computes solar wind dynamic pressure and Parker spiral angle accurately', () => {
    const sw = computeSolarWindMetrics({
      timestamp: new Date().toISOString(),
      speedKmS: 400,
      densityPcm3: 5,
      temperatureK: 95000,
      btNt: 5,
      bzNt: -1.5
    });
    expect(sw.dynamicPressureNpa).toBeCloseTo(1.34, 1);
    expect(sw.parkerSpiralAngleDeg).toBeGreaterThan(40);
    expect(sw.parkerSpiralAngleDeg).toBeLessThan(50);
    expect(sw.parkerFootpointLonDeg).toBeGreaterThan(50);
    expect(sw.parkerFootpointLonDeg).toBeLessThan(65);
  });

  it('predicts direct cislunar & Gateway NRHO hit for West-connected flare', () => {
    const sw = computeSolarWindMetrics({
      timestamp: new Date().toISOString(),
      speedKmS: 680,
      densityPcm3: 14.5,
      temperatureK: 220000,
      btNt: 16,
      bzNt: -11
    });

    const prediction = predictor.predictImpact({
      sourceLocation: 'N14W42',
      coneHalfAngleDeg: 52,
      cmeSpeedKmS: 1450,
      solarWind: sw,
      predictedStormScale: 'S4_SEVERE',
      sepArrivalMinutes: 48,
      moonPhaseAngleDeg: 90
    });

    expect(prediction.primaryImpactZone).toBe('CISLUNAR_AND_EARTH_DIRECT');
    expect(prediction.magneticConnectionScore).toBeGreaterThan(0.7);
    const gateway = prediction.targets.find((t) => t.target === 'GATEWAY_NRHO');
    const cislunar = prediction.targets.find((t) => t.target === 'CISLUNAR_TRANSIT');
    expect(gateway?.status).toBe('DIRECT_HIT');
    expect(cislunar?.status).toBe('DIRECT_HIT');
    expect(gateway?.cmeArrivalHours).toBeGreaterThan(20);
  });

  it('models Earth magnetotail shielding for Moon/Gateway near Full Moon', () => {
    const sw = computeSolarWindMetrics({
      timestamp: new Date().toISOString(),
      speedKmS: 650,
      densityPcm3: 10,
      temperatureK: 180000,
      btNt: 12,
      bzNt: -8
    });

    const prediction = predictor.predictImpact({
      sourceLocation: 'N05W20',
      coneHalfAngleDeg: 45,
      cmeSpeedKmS: 1100,
      solarWind: sw,
      predictedStormScale: 'S3_STRONG',
      sepArrivalMinutes: 40,
      moonPhaseAngleDeg: 0 // Full Moon inside magnetotail
    });

    const gateway = prediction.targets.find((t) => t.target === 'GATEWAY_NRHO');
    const cislunar = prediction.targets.find((t) => t.target === 'CISLUNAR_TRANSIT');
    expect(gateway?.status).toBe('MAGNETOSPHERE_SHIELDED');
    expect(cislunar?.status).toBe('DIRECT_HIT');
  });

  it('compresses magnetopause inside GEO under extreme solar wind pressure and southward Bz', () => {
    const sw = computeSolarWindMetrics({
      timestamp: new Date().toISOString(),
      speedKmS: 1120,
      densityPcm3: 28,
      temperatureK: 500000,
      btNt: 32,
      bzNt: -24.5
    });

    const prediction = predictor.predictImpact({
      sourceLocation: 'S08W32',
      coneHalfAngleDeg: 60,
      cmeSpeedKmS: 1650,
      solarWind: sw,
      predictedStormScale: 'S4_SEVERE',
      sepArrivalMinutes: 0
    });

    expect(prediction.magnetopauseStandoffRe).toBeLessThanOrEqual(6.6);
    expect(prediction.geomagneticGScale).toBe('G5');
    const earth = prediction.targets.find((t) => t.target === 'EARTH_MAGNETOSPHERE');
    expect(earth?.status).toBe('DIRECT_HIT');
  });
});

describe('RadiationEngine (Integration & Simulation Switching)', () => {
  it('switches cleanly between scenarios and custom events', async () => {
    const engine = new RadiationEngine();
    engine.setSimulationScenario('PEAK_STORM_S4');
    const storm = await engine.getCurrentState();
    expect(storm.isSimulated).toBe(true);
    expect(storm.solarWind.speedKmS).toBe(1120);
    expect(storm.impactPrediction.geomagneticGScale).toBe('G5');

    const custom = engine.simulateCustomEvent({
      sourceLocation: 'S15E75',
      flareClass: 'X',
      halfAngleDeg: 30
    });
    expect(custom?.impactPrediction.primaryImpactZone).toBe('DEEP_SPACE_MISS');
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
