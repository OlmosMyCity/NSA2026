/**
 * Phase-adjusted physiological thresholds calibrated against NASA-STD-3001 Vol. 1/2
 * and NASA Human Research Program studies across launch, microgravity, and reentry.
 *
 * @module features/health/domain/phaseNorms
 */

import { INDICATORS } from './indicators';
import type { IndicatorId, StatusSegment } from './types';

export type PhasePhysiologyRegime = 'earth_baseline' | 'launch_ascent' | 'microgravity' | 'entry_landing';

export interface PhaseRegimeInfo {
  regime: PhasePhysiologyRegime;
  label: string;
  note: string;
  source: string;
  /** Tramos por indicador para esta fase (mismo formato contiguo que INDICATORS). */
  overrides: Partial<Record<IndicatorId, StatusSegment[]>>;
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
      heartRate: [{ status: 'red', lt: 45 }, { status: 'amber', lt: 60 }, { status: 'green', lte: 135 }, { status: 'amber', lte: 155 }, { status: 'red' }],
      systolic: [{ status: 'red', lt: 85 }, { status: 'amber', lt: 95 }, { status: 'green', lte: 155 }, { status: 'amber', lte: 170 }, { status: 'red' }],
      diastolic: [{ status: 'green', lte: 95 }, { status: 'amber', lte: 105 }, { status: 'red' }],
      spo2: [{ status: 'red', lt: 91 }, { status: 'amber', lt: 94 }, { status: 'green' }],
    },
  },
  microgravity: {
    regime: 'microgravity',
    label: 'Microgravity / Orbital Cruise (0-G)',
    note: 'Cephalad fluid shift and cardiovascular unloading lower resting HR (45–88 bpm) and SBP (85–125 mmHg); orbital sleep averages ≥ 6.5 h/day.',
    source: 'NASA HRP Cardiovascular & Circadian Studies / NASA-STD-3001 Vol. 1',
    overrides: {
      heartRate: [{ status: 'red', lt: 38 }, { status: 'amber', lt: 45 }, { status: 'green', lte: 88 }, { status: 'amber', lte: 100 }, { status: 'red' }],
      systolic: [{ status: 'red', lt: 78 }, { status: 'amber', lt: 85 }, { status: 'green', lte: 125 }, { status: 'amber', lt: 140 }, { status: 'red' }],
      sleepHours: [{ status: 'red', lt: 5.5 }, { status: 'amber', lt: 6.5 }, { status: 'green' }],
    },
  },
  entry_landing: {
    regime: 'entry_landing',
    label: 'Entry, Descent & Landing',
    note: 'Deceleration +Gx/+Gz load and post-flight orthostatic stress widen expected HR (65–130 bpm) and SBP (85–145 mmHg).',
    source: 'NASA-STD-3001 Vol. 1 & 2 (Reentry & Orthostatic Intolerance)',
    overrides: {
      heartRate: [{ status: 'red', lt: 45 }, { status: 'amber', lt: 55 }, { status: 'green', lte: 130 }, { status: 'amber', lte: 150 }, { status: 'red' }],
      systolic: [{ status: 'red', lt: 75 }, { status: 'amber', lt: 85 }, { status: 'green', lte: 145 }, { status: 'amber', lte: 165 }, { status: 'red' }],
      spo2: [{ status: 'red', lt: 91 }, { status: 'amber', lt: 94 }, { status: 'green' }],
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

/**
 * Tramos de un indicador en una fase de misión. Sin fase (o en 1-G) son los de INDICATORS,
 * que coinciden con HEALTH_BANDS del backend (lo que se guarda y ve el Flight Surgeon).
 * Las normas por fase solo ajustan la lectura contextual en el visor de la misión.
 */
export function getIndicatorSegments(indicator: IndicatorId, phaseId?: string | null): StatusSegment[] {
  return getPhaseRegime(phaseId).overrides[indicator] ?? INDICATORS[indicator].segments;
}
