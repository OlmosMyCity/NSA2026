/**
 * @module components/health/twin/twinMeta
 * Shared visual constants and deterministic threshold-band utilities for the
 * Digital Twin inspector, What-If sliders, and rule-vs-model risk mapping.
 */

import { evaluateIndicator } from '../../../domain/health/evaluate';
import type { HealthStatus, IndicatorId } from '../../../domain/health/types';
import type { RecommendedAction, ZoneRiskLevel } from '../../../services/digitalTwinService';

/** Visible value window per indicator (narrower than the input limits so bands are readable). */
export const VIEW_DOMAIN: Record<IndicatorId, [number, number]> = {
  heartRate: [35, 150],
  systolic: [80, 170],
  diastolic: [50, 110],
  glucose: [50, 250],
  temperature: [34.5, 39.5],
  spo2: [80, 100],
  sleepHours: [0, 12],
  mood: [1, 5],
  resistanceExercise: [0, 120],
};

const BAND_COLOR: Record<HealthStatus, string> = {
  green: 'hsl(var(--hsl-status-nominal) / 0.55)',
  amber: 'hsl(var(--hsl-status-caution) / 0.6)',
  red: 'hsl(var(--hsl-status-critical) / 0.55)',
  unknown: 'hsl(var(--hsl-border-subtle))',
};

/** CSS gradient of the rule engine's green/amber/red bands across a domain. */
export function bandGradient(indicator: IndicatorId, [min, max]: [number, number]): string {
  const samples = 240;
  const stops: string[] = [];
  let prev: HealthStatus | null = null;
  for (let i = 0; i <= samples; i++) {
    const s = evaluateIndicator(indicator, min + ((max - min) * i) / samples).status;
    const pct = (i / samples) * 100;
    if (s !== prev) {
      if (prev) stops.push(`${BAND_COLOR[prev]} ${pct}%`);
      stops.push(`${BAND_COLOR[s]} ${pct}%`);
      prev = s;
    }
  }
  if (prev) stops.push(`${BAND_COLOR[prev]} 100%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function positionPct(value: number, [min, max]: [number, number]): number {
  return ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;
}

export const RISK_META: Record<ZoneRiskLevel, { label: string; color: string; rank: number }> = {
  stable: { label: 'Stable', color: 'var(--status-nominal)', rank: 0 },
  watch: { label: 'Watch', color: 'hsl(var(--hsl-ink-secondary))', rank: 1 },
  elevated: { label: 'Elevated', color: 'var(--status-caution)', rank: 2 },
  critical: { label: 'Critical', color: 'var(--status-critical)', rank: 3 },
};

/** Same mapping the rules fallback uses (digitalTwinService.RISK_BY_STATUS). */
export const RISK_FROM_STATUS: Record<HealthStatus, ZoneRiskLevel> = {
  green: 'stable',
  unknown: 'watch',
  amber: 'elevated',
  red: 'critical',
};

export const ACTION_LABELS: Record<RecommendedAction, string> = {
  re_measure: 'Re-measure in 5–30 min',
  rest: 'Prioritize rest and circadian hygiene',
  exercise: 'Run the ARED / T2 exercise protocol',
  shelter_shielding: 'Move to the storm shelter or add shielding',
  contact_ground: 'Contact the flight surgeon now',
  no_action: 'Nominal, continue mission routine',
};

