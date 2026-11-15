/**
 * Phase-adjusted physiological thresholds calibrated against NASA-STD-3001 Vol. 1/2
 * and NASA Human Research Program studies across launch, microgravity, and reentry.
 *
 * @module domain/health/phaseNorms
 */

import { INDICATORS } from './indicators';
import type { IndicatorId, IndicatorThresholds } from './types';

export type PhasePhysiologyRegime = 'earth_baseline' | 'launch_ascent' | 'microgravity' | 'entry_landing';

export interface PhaseRegimeInfo {
  regime: PhasePhysiologyRegime;
  label: string;
  note: string;
  source: string;
  overrides: Partial<Record<IndicatorId, IndicatorThresholds>>;
}

const REGIMES: Record<PhasePhysiologyRegime, PhaseRegimeInfo> = {
  earth_baseline: {
    regime: 'earth_baseline',
    label: '1-G Earth Baseline',
    note: 'Standard pre-flight clinical screening values (NASA-STD-3001 Vol. 1).',
    source: 'NASA-STD-3001 Vol. 1 (Crew Health)',
    overrides: {},
  },
  launch_ascent: {
    regime: 'launch_ascent',
    label: 'Launch & Ascent (+Gx/+Gz)',
    note: 'Transient sympathetic tachycardia (70–135 bpm) and pressor response (SBP 100–155 mmHg) are physiologically normal under +Gx/+Gz acceleration.',
    source: 'NASA-STD-3001 Vol. 2 (LEL Acceleration) & NASA HRP Ascent Telemetry',
    overrides: {
      heartRate: {
        green: { min: 60, max: 135 },
        amber: [
          { min: 45, max: 59 },
          { min: 136, max: 155 },
        ],
      },
      systolic: {
        green: { min: 95, max: 155 },
        amber: [
          { min: 85, max: 94 },
          { min: 156, max: 170 },
        ],
      },
      diastolic: {
        green: { max: 95 },
        amber: [{ min: 96, max: 105 }],
      },
      spo2: {
        green: { min: 94 },
        amber: [{ min: 91, max: 93.99 }],
      },
    },
  },
  microgravity: {
    regime: 'microgravity',
    label: 'Microgravity / Orbital Cruise (0-G)',
    note: 'Cephalad fluid shift and cardiovascular unloading lower resting HR (45–88 bpm) and SBP (85–125 mmHg); orbital sleep averages ≥ 6.5 h/day.',
    source: 'NASA HRP Cardiovascular & Circadian Studies / NASA-STD-3001 Vol. 1',
    overrides: {
      heartRate: {
        green: { min: 45, max: 88 },
        amber: [
          { min: 38, max: 44 },
          { min: 89, max: 100 },
        ],
      },
      systolic: {
        green: { min: 85, max: 125 },
        amber: [
          { min: 78, max: 84 },
          { min: 126, max: 139 },
        ],
      },
      sleepHours: {
        green: { min: 6.5 },
        amber: [{ min: 5.5, max: 6.49 }],
      },
    },
  },
  entry_landing: {
    regime: 'entry_landing',
    label: 'Entry, Descent & Landing',
    note: 'Deceleration +Gx/+Gz load and post-flight orthostatic stress widen expected HR (65–130 bpm) and SBP (85–145 mmHg).',
    source: 'NASA-STD-3001 Vol. 1 & 2 (Reentry & Orthostatic Intolerance)',
    overrides: {
      heartRate: {
        green: { min: 55, max: 130 },
        amber: [
          { min: 45, max: 54 },
          { min: 131, max: 150 },
        ],
      },
      systolic: {
        green: { min: 85, max: 145 },
        amber: [
          { min: 75, max: 84 },
          { min: 146, max: 165 },
        ],
      },
      spo2: {
        green: { min: 94 },
        amber: [{ min: 91, max: 93.99 }],
      },
    },
  },
};

const PHASE_TO_REGIME: Record<string, PhasePhysiologyRegime> = {
  ascent: 'launch_ascent',
  heo: 'launch_ascent',
  parking: 'microgravity',
  leo: 'microgravity',
  outbound: 'microgravity',
  transit: 'microgravity',
  cruise: 'microgravity',
  lunar_orbit: 'microgravity',
  nrho: 'microgravity',
  return: 'microgravity',
  flyby: 'microgravity',
  gravity_assist: 'microgravity',
  perihelion: 'microgravity',
  approach: 'entry_landing',
  descent: 'entry_landing',
  edl: 'entry_landing',
  landing: 'entry_landing',
};

export function getPhaseRegime(phaseId?: string | null): PhaseRegimeInfo {
  const regime = (phaseId && PHASE_TO_REGIME[phaseId]) || 'earth_baseline';
  return REGIMES[regime];
}

export function getIndicatorThresholds(
  indicator: IndicatorId,
  phaseId?: string | null,
): IndicatorThresholds {
  const info = getPhaseRegime(phaseId);
  return info.overrides[indicator] ?? INDICATORS[indicator].thresholds;
}
