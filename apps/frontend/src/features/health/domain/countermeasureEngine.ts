/**
 * @module health/domain/countermeasureEngine
 * NASA HRP & NASA-STD-3001 backed decision and countermeasure simulation engine.
 *
 * Translates actionable crew countermeasures (linked 1-to-1 with `/routine` tasks)
 * into bounded physiological deltas across the 9 monitored indicators, evaluates
 * before/after 5-zone statuses, and ranks pending actions by expected risk reduction.
 */

import { evaluateIndicator } from './evaluate';
import { INDICATORS, INDICATOR_IDS } from './indicators';
import { summarizeZones } from './summary';
import { API_FIELD, toIndicatorReadings, type ApiHealthReading } from './api-adapter';
import type { BodyZoneId, HealthStatus, IndicatorId, SpaceHazard } from './types';

/** Canonical countermeasure IDs matching `routineService` daily tasks. */
export type CountermeasureId =
  | 'task-ared-resistive'
  | 'task-t2-cardio'
  | 'task-hydration-electrolytes'
  | 'task-nutrition-ration'
  | 'task-circadian-light'
  | 'task-mood-debrief';

export interface CountermeasureSpec {
  id: CountermeasureId;
  title: string;
  shortLabel: string;
  durationMin: number;
  hazard: SpaceHazard;
  targetZones: BodyZoneId[];
  nasaRef: string;
  mechanism: string;
  applyEffect: (reading: ApiHealthReading) => Partial<ApiHealthReading>;
}

const INDICATOR_ORDER: IndicatorId[] = INDICATOR_IDS;

const NOMINAL_TARGETS: Record<IndicatorId, number> = {
  heartRate: 70,
  systolic: 115,
  diastolic: 75,
  glucose: 95,
  temperature: 36.6,
  spo2: 98,
  sleepHours: 8,
  mood: 5,
  resistanceExercise: 75,
};

const INDICATOR_SCALES: Record<IndicatorId, number> = {
  heartRate: 25,
  systolic: 25,
  diastolic: 15,
  glucose: 45,
  temperature: 1.0,
  spo2: 5,
  sleepHours: 2.0,
  mood: 2.0,
  resistanceExercise: 60,
};

const RISK_WEIGHT: Record<HealthStatus, number> = {
  green: 0,
  unknown: 1,
  amber: 2,
  red: 3,
};

const ZONE_IDS: BodyZoneId[] = ['heart', 'brain', 'blood', 'bones', 'sleep'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampReading(r: ApiHealthReading): ApiHealthReading {
  return {
    ...r,
    heartRateBpm: Math.round(clamp(r.heartRateBpm, 45, 200)),
    systolicMmHg: Math.round(clamp(r.systolicMmHg, 85, 220)),
    diastolicMmHg: Math.round(clamp(r.diastolicMmHg, 50, 130)),
    glucoseMgDl: Math.round(clamp(r.glucoseMgDl, 50, 400)),
    temperatureC: Number(clamp(r.temperatureC, 35.5, 41).toFixed(1)),
    spo2Pct: Math.round(clamp(r.spo2Pct, 85, 100)),
    sleepHours: Number(clamp(r.sleepHours, 0, 10).toFixed(1)),
    mood: Math.round(clamp(r.mood, 1, 5)),
    resistanceExerciseMin:
      typeof r.resistanceExerciseMin === 'number'
        ? Math.round(clamp(r.resistanceExerciseMin, 0, 120))
        : r.resistanceExerciseMin,
  };
}

/**
 * Six evidence-grounded operational countermeasures mapped from NASA-STD-3001
 * Vol. 1 & 2 and NASA Human Research Program (HRP) protocols.
 */
export const COUNTERMEASURES: CountermeasureSpec[] = [
  {
    id: 'task-ared-resistive',
    title: 'ARED Strength Training',
    shortLabel: 'ARED Resistive',
    durationMin: 60,
    hazard: 'gravity',
    targetZones: ['bones', 'blood'],
    nasaRef: 'NASA-STD-3001 Vol. 1 §4.4 · HRP Bone & Muscle Loss',
    mechanism:
      'High-load axial resistance stimulates osteoblast remodeling and recruits skeletal muscle GLUT4 glucose uptake.',
    applyEffect: (r) => ({
      resistanceExerciseMin: Math.min(120, (r.resistanceExerciseMin ?? 0) + 60),
      glucoseMgDl:
        r.glucoseMgDl > 115
          ? r.glucoseMgDl - Math.min(12, Math.round((r.glucoseMgDl - 110) * 0.25))
          : r.glucoseMgDl,
    }),
  },
  {
    id: 'task-t2-cardio',
    title: 'T2 / CEVIS Aerobic Cardio',
    shortLabel: 'T2 Aerobic',
    durationMin: 30,
    hazard: 'gravity',
    targetZones: ['heart', 'blood', 'bones'],
    nasaRef: 'NASA HRP Aerobic Conditioning & VO2max Preservation',
    mechanism:
      'Restores vagal tone, arterial compliance, and alveolar O2 recruitment against microgravity deconditioning.',
    applyEffect: (r) => ({
      heartRateBpm:
        r.heartRateBpm > 75
          ? r.heartRateBpm - Math.min(9, Math.round((r.heartRateBpm - 70) * 0.35))
          : r.heartRateBpm,
      systolicMmHg:
        r.systolicMmHg > 124
          ? r.systolicMmHg - Math.min(8, Math.round((r.systolicMmHg - 118) * 0.35))
          : r.systolicMmHg,
      diastolicMmHg:
        r.diastolicMmHg > 82
          ? r.diastolicMmHg - Math.min(5, Math.round((r.diastolicMmHg - 78) * 0.35))
          : r.diastolicMmHg,
      spo2Pct: r.spo2Pct < 98 ? r.spo2Pct + Math.min(2, 98 - r.spo2Pct) : r.spo2Pct,
      resistanceExerciseMin:
        typeof r.resistanceExerciseMin === 'number'
          ? Math.min(120, r.resistanceExerciseMin + 15)
          : r.resistanceExerciseMin,
    }),
  },
  {
    id: 'task-hydration-electrolytes',
    title: 'Hydration & Potassium Citrate',
    shortLabel: 'Hydration 2.5 L',
    durationMin: 15,
    hazard: 'hostileEnvironment',
    targetZones: ['heart', 'blood'],
    nasaRef: 'NASA HRP Fluid Loading & Renal Stone Mitigation',
    mechanism:
      'Expands intravascular plasma volume after cephalad fluid shift, stabilizes BP, and aids thermoregulation.',
    applyEffect: (r) => {
      let systolicMmHg = r.systolicMmHg;
      if (r.systolicMmHg > 130) systolicMmHg = r.systolicMmHg - 5;
      else if (r.systolicMmHg < 95) systolicMmHg = r.systolicMmHg + 6;

      return {
        heartRateBpm: r.heartRateBpm > 80 ? r.heartRateBpm - 5 : r.heartRateBpm,
        systolicMmHg,
        temperatureC:
          r.temperatureC > 37.3 ? Number((r.temperatureC - 0.3).toFixed(1)) : r.temperatureC,
        glucoseMgDl: r.glucoseMgDl > 135 ? r.glucoseMgDl - 8 : r.glucoseMgDl,
      };
    },
  },
  {
    id: 'task-nutrition-ration',
    title: 'Space Ration & Vit-D Protocol',
    shortLabel: 'Space Ration + Vit-D',
    durationMin: 20,
    hazard: 'hostileEnvironment',
    targetZones: ['blood', 'bones', 'brain'],
    nasaRef: 'NASA-STD-3001 Vol. 2 §7.1 · Nutrition & Vit-D3 Synergy',
    mechanism:
      'Corrects hypo/hyperglycemic excursions with targeted ration composition while Vit-D3 + calcium support bone mineralization.',
    applyEffect: (r) => {
      let glucoseMgDl = r.glucoseMgDl;
      if (r.glucoseMgDl < 80) glucoseMgDl = Math.min(100, r.glucoseMgDl + 22);
      else if (r.glucoseMgDl > 140) glucoseMgDl = Math.max(115, r.glucoseMgDl - 18);

      return {
        glucoseMgDl,
        resistanceExerciseMin:
          typeof r.resistanceExerciseMin === 'number'
            ? Math.min(120, r.resistanceExerciseMin + 10)
            : r.resistanceExerciseMin,
        mood: r.glucoseMgDl < 75 && r.mood < 5 ? Math.min(5, r.mood + 1) : r.mood,
      };
    },
  },
  {
    id: 'task-circadian-light',
    title: 'Circadian Spectrum Shift & Rest',
    shortLabel: 'Circadian Sleep',
    durationMin: 5,
    hazard: 'isolation',
    targetZones: ['sleep', 'brain', 'heart'],
    nasaRef: 'NASA HRP Solid-State Lighting & Circadian Alignment',
    mechanism:
      'Blue-depleted evening lighting cues endogenous melatonin onset, extending sleep continuity and nocturnal HR recovery.',
    applyEffect: (r) => ({
      sleepHours: Number(Math.min(8.5, r.sleepHours + 1.5).toFixed(1)),
      heartRateBpm: r.heartRateBpm > 76 ? r.heartRateBpm - 4 : r.heartRateBpm,
      mood: r.sleepHours < 7 && r.mood < 5 ? Math.min(5, r.mood + 1) : r.mood,
    }),
  },
  {
    id: 'task-mood-debrief',
    title: 'Behavioral Decompression & Sync',
    shortLabel: 'Decompression',
    durationMin: 15,
    hazard: 'isolation',
    targetZones: ['brain', 'heart'],
    nasaRef: 'NASA HRP Behavioral Health & Performance (BHP)',
    mechanism:
      'Mitigates confinement stress and attenuates sympathetic pressor surges during high-tempo flight days.',
    applyEffect: (r) => ({
      mood: Math.min(5, r.mood + 1),
      systolicMmHg: r.systolicMmHg > 125 ? r.systolicMmHg - 4 : r.systolicMmHg,
      heartRateBpm: r.heartRateBpm > 80 ? r.heartRateBpm - 4 : r.heartRateBpm,
    }),
  },
];

export const COUNTERMEASURE_BY_ID: Record<CountermeasureId, CountermeasureSpec> = COUNTERMEASURES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<CountermeasureId, CountermeasureSpec>
);

export interface MetricDelta {
  indicator: IndicatorId;
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  beforeStatus: HealthStatus;
  afterStatus: HealthStatus;
}

export interface ZoneTransition {
  zone: BodyZoneId;
  before: HealthStatus;
  after: HealthStatus;
}

export interface RankedCountermeasure {
  spec: CountermeasureSpec;
  isCompletedInRoutine: boolean;
  /** 1-based priority among pending routine countermeasures; `null` if already completed today. */
  priorityRank: number | null;
  zonesImprovedCount: number;
  severityReduction: number;
  metricDeltas: MetricDelta[];
  zoneTransitions: ZoneTransition[];
}

/**
 * Applies all selected countermeasures in sequence to a clone of `baseline`,
 * returning a physiologically clamped simulated reading.
 */
export function simulateCountermeasures(
  baseline: ApiHealthReading,
  selectedIds: CountermeasureId[]
): ApiHealthReading {
  const ordered = COUNTERMEASURES.filter((c) => selectedIds.includes(c.id));
  let current: ApiHealthReading = { ...baseline };
  for (const spec of ordered) {
    current = clampReading({ ...current, ...spec.applyEffect(current) });
  }
  return current;
}

function readNumericIndicator(reading: ApiHealthReading, id: IndicatorId): number | null {
  const value = reading[API_FIELD[id]];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Computes concrete indicator changes between a baseline reading and simulated reading. */
export function computeMetricDeltas(
  baseline: ApiHealthReading,
  simulated: ApiHealthReading
): MetricDelta[] {
  const deltas: MetricDelta[] = [];

  for (const id of INDICATOR_ORDER) {
    const rawBefore = readNumericIndicator(baseline, id);
    const rawAfter = readNumericIndicator(simulated, id);
    if (rawAfter === null) continue;

    const before = rawBefore ?? 0;
    const delta = Number((rawAfter - before).toFixed(1));
    if (delta === 0 && rawBefore !== null) continue;
    if (rawBefore === null && delta === 0) continue;

    const def = INDICATORS[id];
    const beforeEval =
      rawBefore !== null
        ? evaluateIndicator(id, rawBefore).status
        : ('unknown' as HealthStatus);
    const afterEval = evaluateIndicator(id, rawAfter).status;

    deltas.push({
      indicator: id,
      label: def.label,
      unit: def.unit,
      before,
      after: rawAfter,
      delta,
      beforeStatus: beforeEval,
      afterStatus: afterEval,
    });
  }

  return deltas;
}

/**
 * Evaluates every NASA HRP countermeasure individually against `baseline` and
 * ranks pending routine actions by expected physiological risk reduction so the
 * astronaut sees which task to prioritize first.
 */
export function rankCountermeasuresByImpact(
  baseline: ApiHealthReading,
  completedRoutineIds: string[]
): RankedCountermeasure[] {
  const completedSet = new Set(completedRoutineIds);
  const baseZones = summarizeZones(toIndicatorReadings(baseline));

  const scored: RankedCountermeasure[] = COUNTERMEASURES.map((spec) => {
    const simulated = simulateCountermeasures(baseline, [spec.id]);
    const simZones = summarizeZones(toIndicatorReadings(simulated));
    const metricDeltas = computeMetricDeltas(baseline, simulated);

    let zonesImprovedCount = 0;
    let zoneSeverityDrop = 0;
    const zoneTransitions: ZoneTransition[] = [];

    for (const zone of ZONE_IDS) {
      const before = baseZones[zone].status;
      const after = simZones[zone].status;
      const drop = RISK_WEIGHT[before] - RISK_WEIGHT[after];
      if (drop > 0) {
        zonesImprovedCount += 1;
        zoneSeverityDrop += drop * 10;
      }
      if (before !== after || (spec.targetZones.includes(zone) && after !== 'green')) {
        zoneTransitions.push({ zone, before, after });
      }
    }

    // Add status-step and normalized distance-to-target tie-breakers for each changed indicator.
    let indicatorScore = 0;
    for (const d of metricDeltas) {
      const statusDrop = Math.max(0, RISK_WEIGHT[d.beforeStatus] - RISK_WEIGHT[d.afterStatus]);
      const target = NOMINAL_TARGETS[d.indicator];
      const scale = INDICATOR_SCALES[d.indicator];
      const beforeDist = Math.abs(d.before - target) / scale;
      const afterDist = Math.abs(d.after - target) / scale;
      const normalizedGain = Math.max(0, beforeDist - afterDist);
      indicatorScore += statusDrop * 3 + normalizedGain;
    }

    const severityReduction = Number((zoneSeverityDrop + indicatorScore).toFixed(2));

    return {
      spec,
      isCompletedInRoutine: completedSet.has(spec.id),
      priorityRank: null,
      zonesImprovedCount,
      severityReduction,
      metricDeltas,
      zoneTransitions,
    };
  });

  scored.sort((a, b) => {
    if (a.isCompletedInRoutine !== b.isCompletedInRoutine) {
      return a.isCompletedInRoutine ? 1 : -1;
    }
    if (b.severityReduction !== a.severityReduction) {
      return b.severityReduction - a.severityReduction;
    }
    return b.metricDeltas.length - a.metricDeltas.length;
  });

  let rank = 1;
  for (const item of scored) {
    if (!item.isCompletedInRoutine) {
      item.priorityRank = rank++;
    }
  }

  return scored;
}

