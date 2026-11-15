'use client';

/**
 * @module health/components/twin/ScenarioDock
 * Instrument-grade Countermeasure & Priority Simulator for the 3D Digital Twin.
 *
 * Replaces raw physiological vital sliders with actionable mission countermeasures
 * linked directly to `/routine`, ranks pending actions by expected physiological
 * risk reduction, and locks the habitat environment to the astronaut's real mission.
 */

import {
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  rankCountermeasuresByImpact,
  type CountermeasureId,
  type MetricDelta,
  type RankedCountermeasure,
} from '../../../domain/health/countermeasureEngine';
import type { ApiHealthReading } from '../../../domain/health/api-adapter';
import type {
  MissionEnvironment,
  NOAAStormScale,
  ShieldingType,
} from '../../../services/digitalTwinService';

export interface WhatIfState {
  active: boolean;
  selectedActions: CountermeasureId[];
  shielding: ShieldingType;
  rehearseSolarStorm: boolean;
}

export const INITIAL_WHAT_IF: WhatIfState = {
  active: false,
  selectedActions: [],
  shielding: 'CREW_CABIN_NOMINAL',
  rehearseSolarStorm: false,
};

interface ScenarioDockProps {
  value: WhatIfState;
  baselineReading: ApiHealthReading;
  hasRealReading: boolean;
  missionEnvironment: MissionEnvironment;
  missionName: string | null;
  liveStormScale: NOAAStormScale;
  completedRoutineIds: string[];
  isEvaluating: boolean;
  isDirty: boolean;
  onChange: (next: WhatIfState) => void;
  onRun: () => void;
  onReset: () => void;
  onMarkRoutineDone: (taskId: CountermeasureId, completed: boolean) => void;
}

const ENVIRONMENT_LABELS: Record<MissionEnvironment, string> = {
  SPACECRAFT: 'Orion Spacecraft',
  STATION: 'Orbital Station',
  LUNAR_BASE: 'Lunar Base',
  ROVER: 'Pressurized Rover',
  MARS_BASE: 'Mars Base',
};

const STORM_LABELS: Record<NOAAStormScale, string> = {
  S0_NOMINAL: 'S0 Quiet',
  S1_MINOR: 'S1 Minor',
  S2_MODERATE: 'S2 Moderate',
  S3_STRONG: 'S3 Strong',
  S4_SEVERE: 'S4 Severe SPE',
  S5_EXTREME: 'S5 Extreme SPE',
};

const SHORT_METRIC_NAMES: Record<MetricDelta['indicator'], string> = {
  heartRate: 'HR',
  systolic: 'SBP',
  diastolic: 'DBP',
  glucose: 'Glucose',
  temperature: 'Temp',
  spo2: 'SpO₂',
  sleepHours: 'Sleep',
  mood: 'Mood',
  resistanceExercise: 'ARED',
};

const SHIELDING_OPTIONS: { value: ShieldingType; label: string; spec: string }[] = [
  { value: 'EVA_SUIT', label: 'EVA Suit', spec: '1.2 g/cm²' },
  { value: 'CREW_CABIN_NOMINAL', label: 'Crew Cabin', spec: '10 g/cm²' },
  { value: 'STORM_SHELTER', label: 'Storm Shelter', spec: '25 g/cm²' },
];

function priorityText(item: RankedCountermeasure): string {
  if (item.isCompletedInRoutine) return 'Done';
  return `#${item.priorityRank ?? '-'}`;
}

/** Countermeasure Decision & Priority Simulator grounded in NASA HRP / NASA-STD-3001. */
export function ScenarioDock({
  value,
  baselineReading,
  hasRealReading,
  missionEnvironment,
  missionName,
  liveStormScale,
  completedRoutineIds,
  isEvaluating,
  isDirty,
  onChange,
  onRun,
  onReset,
  onMarkRoutineDone,
}: ScenarioDockProps) {
  const ranked = rankCountermeasuresByImpact(baselineReading, completedRoutineIds);
  const topPending = ranked.find((item) => !item.isCompletedInRoutine) ?? null;
  const allPendingIds = ranked
    .filter((item) => !item.isCompletedInRoutine)
    .map((item) => item.spec.id);

  const effectiveStormScale: NOAAStormScale = value.rehearseSolarStorm ? 'S4_SEVERE' : liveStormScale;
  const hasDecisions =
    value.selectedActions.length > 0 ||
    value.shielding !== 'CREW_CABIN_NOMINAL' ||
    value.rehearseSolarStorm;

  const commitState = (patch: Partial<WhatIfState>) => {
    const next: WhatIfState = { ...value, ...patch };
    const anyDecision =
      next.selectedActions.length > 0 ||
      next.shielding !== 'CREW_CABIN_NOMINAL' ||
      next.rehearseSolarStorm;
    onChange({
      ...next,
      active: hasRealReading ? anyDecision : true,
    });
  };

  const toggleAction = (id: CountermeasureId) => {
    const exists = value.selectedActions.includes(id);
    const nextActions = exists
      ? value.selectedActions.filter((item) => item !== id)
      : [...value.selectedActions, id];
    commitState({ selectedActions: nextActions });
  };

  return (
    <section aria-labelledby="scenario-title" className="twin-panel space-y-4 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="scenario-title" className="text-sm font-semibold text-blueberry">
              Countermeasure simulator
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stem">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  hasDecisions ? 'bg-status-caution' : 'bg-status-nominal'
                }`}
              />
              {hasDecisions
                ? `Simulating ${value.selectedActions.length}`
                : hasRealReading
                  ? 'Last reading'
                  : 'Baseline'}
            </span>
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stem">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3 opacity-75" aria-hidden="true" />
              {ENVIRONMENT_LABELS[missionEnvironment]}
              {missionName ? ` · ${missionName}` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                effectiveStormScale === 'S0_NOMINAL' ? 'text-stem' : 'font-medium text-status-caution'
              }
            >
              {STORM_LABELS[effectiveStormScale]}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {topPending && (
            <button
              type="button"
              onClick={() => commitState({ selectedActions: [topPending.spec.id] })}
              className="twin-btn twin-btn-ghost h-8 px-2.5 text-xs"
            >
              Simulate #1
            </button>
          )}
          {allPendingIds.length > 1 && (
            <button
              type="button"
              onClick={() => commitState({ selectedActions: allPendingIds })}
              className="twin-btn twin-btn-ghost h-8 px-2.5 text-xs"
            >
              Simulate all
            </button>
          )}
        </div>
      </header>

      {/* Instrument checklist: NASA HRP countermeasures ranked by physiological impact */}
      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2 pb-1.5 text-[11px] font-medium text-stem sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_4.5rem]">
          <span>Countermeasure</span>
          <span className="hidden sm:block">Projected effect</span>
          <span className="text-right">Priority</span>
        </div>

        <ul className="divide-y divide-line/50 border-y border-line/50">
          {ranked.map((item) => {
            const isSelected = value.selectedActions.includes(item.spec.id);
            const isTopUrgent =
              !item.isCompletedInRoutine && item.priorityRank === 1 && item.severityReduction > 0;

            return (
              <li
                key={item.spec.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-2.5 transition-colors duration-ui sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_4.5rem] ${
                  isSelected ? 'bg-plate/[0.06]' : 'hover:bg-plate/[0.03]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAction(item.spec.id)}
                  aria-pressed={isSelected}
                  className="flex min-w-0 items-start gap-2.5 text-left active:scale-[0.99] transition-transform duration-press"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-ui ${
                      isSelected
                        ? 'border-berry bg-berry text-canvas'
                        : 'border-line bg-canvas/60 text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3 stroke-[2.5]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-blueberry">
                      {item.spec.title}
                    </span>
                    <span className="block truncate text-[11px] text-stem">
                      {item.spec.durationMin} min · {item.spec.nasaRef}
                    </span>
                  </span>
                </button>

                <div className="hidden min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] sm:flex">
                  {item.metricDeltas.length > 0 ? (
                    item.metricDeltas.slice(0, 2).map((d) => {
                      const improvedToGreen =
                        d.beforeStatus !== d.afterStatus && d.afterStatus === 'green';
                      return (
                        <span key={d.indicator} className="twin-value whitespace-nowrap text-stem">
                          {SHORT_METRIC_NAMES[d.indicator]}{' '}
                          <span className="text-blueberry/80">{d.before}</span>
                          <span aria-hidden="true" className="mx-0.5 opacity-60">
                            →
                          </span>
                          <span
                            className={
                              improvedToGreen ? 'font-semibold text-status-nominal' : 'font-semibold text-blueberry'
                            }
                          >
                            {d.after}
                          </span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[11px] text-stem/75">Sustains baseline</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`twin-value text-xs font-semibold ${
                      item.isCompletedInRoutine
                        ? 'text-status-nominal'
                        : isTopUrgent
                          ? 'text-status-caution'
                          : 'text-stem'
                    }`}
                  >
                    {priorityText(item)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMarkRoutineDone(item.spec.id, !item.isCompletedInRoutine)}
                    title={
                      item.isCompletedInRoutine
                        ? 'Undo completion in daily routine'
                        : 'Mark completed in daily routine'
                    }
                    aria-label={
                      item.isCompletedInRoutine
                        ? `Undo ${item.spec.title} in routine`
                        : `Mark ${item.spec.title} done in routine`
                    }
                    className="rounded p-1 text-stem transition-colors duration-ui hover:bg-plate/10 hover:text-blueberry active:scale-95"
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        item.isCompletedInRoutine ? 'text-status-nominal' : 'opacity-60'
                      }`}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Shielding posture & solar particle storm rehearsal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <span className="twin-label shrink-0">Shielding</span>
          <div
            role="radiogroup"
            aria-label="Habitat shielding posture"
            className="twin-segmented min-w-[240px] flex-1 max-w-md"
          >
            {SHIELDING_OPTIONS.map((opt) => {
              const checked = value.shielding === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => commitState({ shielding: opt.value })}
                  className="twin-segment"
                >
                  <span>{opt.label}</span>
                  <span className="hidden text-[10px] font-normal opacity-70 sm:inline">{opt.spec}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={value.rehearseSolarStorm}
          onClick={() => commitState({ rehearseSolarStorm: !value.rehearseSolarStorm })}
          className={`twin-btn h-8 px-2.5 text-xs ${
            value.rehearseSolarStorm
              ? 'bg-status-critical/15 text-status-critical'
              : 'twin-btn-ghost'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          S4 storm drill
        </button>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/50 pt-3">
        <p className="text-xs text-stem" aria-live="polite">
          {isEvaluating
            ? 'Evaluating clinical triage…'
            : isDirty
              ? 'Scenario changed since the last triage.'
              : 'Triage is up to date.'}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            disabled={(!value.active && !hasDecisions) || isEvaluating}
            className="twin-btn twin-btn-ghost"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={isEvaluating || !isDirty}
            className="twin-btn twin-btn-primary"
          >
            {isEvaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Evaluate triage
          </button>
        </div>
      </footer>
    </section>
  );
}
