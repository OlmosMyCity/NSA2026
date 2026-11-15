'use client';

/**
 * @module health/components/twin/ScenarioDock
 * NASA-backed Countermeasure & Priority Decision Simulator for the 3D Digital Twin.
 *
 * Replaces raw physiological vital sliders with actionable mission countermeasures
 * linked directly to `/routine`, ranks pending actions by expected physiological
 * risk reduction, and locks the habitat environment to the astronaut's real mission.
 */

import {
  Check,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Lock,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  rankCountermeasuresByImpact,
  type CountermeasureId,
  type MetricDelta,
  type RankedCountermeasure,
} from '../../../domain/health/countermeasureEngine';
import type { ApiHealthReading } from '../../../domain/health/api-adapter';
import { BODY_ZONES } from '../../../domain/health/education';
import { STATUS_THEME } from '../../../domain/health/status-theme';
import type { HealthStatus } from '../../../domain/health/types';
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
  S0_NOMINAL: 'S0 · Quiet Sun',
  S1_MINOR: 'S1 · Minor Storm',
  S2_MODERATE: 'S2 · Moderate Storm',
  S3_STRONG: 'S3 · Strong Storm',
  S4_SEVERE: 'S4 · Severe SPE',
  S5_EXTREME: 'S5 · Extreme SPE',
};

const SHIELDING_OPTIONS: { value: ShieldingType; label: string; spec: string }[] = [
  { value: 'EVA_SUIT', label: 'EVA Suit', spec: '1.2 g/cm²' },
  { value: 'CREW_CABIN_NOMINAL', label: 'Crew Cabin', spec: '10 g/cm²' },
  { value: 'STORM_SHELTER', label: 'Storm Shelter', spec: '25 g/cm²' },
];

function formatDeltaSign(delta: number): string {
  const rounded = Number.isInteger(delta) ? delta.toString() : delta.toFixed(1);
  return delta > 0 ? `+${rounded}` : rounded;
}

function formatRankLabel(item: RankedCountermeasure): string {
  if (item.isCompletedInRoutine) return 'Done in routine';
  if (item.priorityRank === 1) return '#1 Priority';
  return `#${item.priorityRank ?? '-'} Priority`;
}

function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: STATUS_THEME[status].color }}
    />
  );
}

function DeltaChip({ delta }: { delta: MetricDelta }) {
  const statusImproved = delta.beforeStatus !== delta.afterStatus && delta.afterStatus === 'green';
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line/60 bg-canvas/55 px-2 py-0.5 text-[11px] text-blueberry">
      <span className="text-stem">{delta.label}:</span>
      <span className="twin-value text-stem">{delta.before}</span>
      <span aria-hidden="true" className="text-stem/70">
        →
      </span>
      <span
        className="twin-value font-semibold"
        style={{ color: statusImproved ? 'var(--status-nominal)' : undefined }}
      >
        {delta.after} {delta.unit}
      </span>
      <span className="twin-value text-[10px] text-status-nominal">
        ({formatDeltaSign(delta.delta)})
      </span>
    </span>
  );
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

  const simulateTopPriority = () => {
    if (!topPending) return;
    commitState({ selectedActions: [topPending.spec.id] });
  };

  const simulateAllPending = () => {
    if (allPendingIds.length === 0) return;
    commitState({ selectedActions: allPendingIds });
  };

  return (
    <section aria-labelledby="scenario-title" className="twin-panel space-y-4 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="scenario-title" className="text-sm font-semibold text-blueberry">
              Countermeasure &amp; priority simulator
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                hasDecisions ? 'bg-status-caution/15 text-status-caution' : 'bg-plate/5 text-stem'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  hasDecisions ? 'bg-status-caution' : 'bg-status-nominal'
                }`}
              />
              {hasDecisions
                ? `Simulating ${value.selectedActions.length} action${value.selectedActions.length === 1 ? '' : 's'}`
                : hasRealReading
                  ? 'Baseline telemetry'
                  : 'Simulated baseline'}
            </span>
          </div>
          <p className="text-xs text-stem">
            Test completing your NASA HRP countermeasures to predict physiological recovery and prioritize routine tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {topPending && (
            <button
              type="button"
              onClick={simulateTopPriority}
              className="twin-btn twin-btn-ghost h-8 border border-line/70 px-2.5 text-xs"
            >
              <Zap className="h-3.5 w-3.5 text-status-caution" aria-hidden="true" />
              Simulate #1 priority
            </button>
          )}
          {allPendingIds.length > 1 && (
            <button
              type="button"
              onClick={simulateAllPending}
              className="twin-btn twin-btn-ghost h-8 border border-line/70 px-2.5 text-xs"
            >
              <FlaskConical className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              Simulate all pending ({allPendingIds.length})
            </button>
          )}
        </div>
      </header>

      {/* Fixed operational mission & space weather context (non-editable) */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line/50 bg-canvas/45 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-blueberry">
          <Lock className="h-3.5 w-3.5 text-stem" aria-hidden="true" />
          Assigned habitat:
          <span className="text-berry">{ENVIRONMENT_LABELS[missionEnvironment]}</span>
          {missionName && <span className="text-stem">· {missionName}</span>}
        </span>
        <span aria-hidden="true" className="text-line">
          |
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-blueberry">
          <Radio
            className={`h-3.5 w-3.5 ${
              effectiveStormScale === 'S0_NOMINAL' ? 'text-status-nominal' : 'text-status-caution'
            }`}
            aria-hidden="true"
          />
          Space weather:
          <span
            className={
              effectiveStormScale === 'S0_NOMINAL' ? 'text-status-nominal' : 'text-status-caution'
            }
          >
            {STORM_LABELS[effectiveStormScale]}
          </span>
        </span>
      </div>

      {/* Prioritized NASA HRP Countermeasure Cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {ranked.map((item) => {
          const isSelected = value.selectedActions.includes(item.spec.id);
          const isTopUrgent = !item.isCompletedInRoutine && item.priorityRank === 1 && item.severityReduction > 0;
          const borderClass = isSelected
            ? 'border-berry/70 bg-[hsl(var(--hsl-surface-hover))]'
            : isTopUrgent
              ? 'border-status-caution/50 bg-canvas/45'
              : 'border-line/60 bg-canvas/45';

          return (
            <article
              key={item.spec.id}
              className={`flex flex-col justify-between gap-3 rounded-[9px] border p-3 transition-colors duration-ui ${borderClass}`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.isCompletedInRoutine
                        ? 'bg-status-nominal/15 text-status-nominal'
                        : isTopUrgent
                          ? 'bg-status-caution/15 text-status-caution'
                          : 'bg-plate/10 text-stem'
                    }`}
                  >
                    {item.isCompletedInRoutine && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                    {formatRankLabel(item)}
                  </span>

                  <span className="text-[11px] text-stem tabular-nums">
                    {item.spec.durationMin} min ·{' '}
                    {item.spec.targetZones.map((z) => BODY_ZONES[z].label).join(', ')}
                  </span>
                </div>

                <div>
                  <h3 className="text-[13px] font-semibold text-blueberry">{item.spec.title}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stem">{item.spec.mechanism}</p>
                  <p className="mt-1 text-[10px] font-medium text-berry/90">{item.spec.nasaRef}</p>
                </div>

                {item.metricDeltas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {item.metricDeltas.slice(0, 3).map((d) => (
                      <DeltaChip key={d.indicator} delta={d} />
                    ))}
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-stem">
                    <StatusDot status="green" />
                    Target vitals already nominal — sustains baseline homeostasis.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/40 pt-2.5">
                <button
                  type="button"
                  onClick={() => toggleAction(item.spec.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors duration-ui ${
                    isSelected
                      ? 'bg-berry text-canvas'
                      : 'border border-line/70 bg-canvas/60 text-blueberry hover:bg-plate/10'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {isSelected ? 'Simulating' : 'Simulate impact'}
                </button>

                <button
                  type="button"
                  onClick={() => onMarkRoutineDone(item.spec.id, !item.isCompletedInRoutine)}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-stem transition-colors duration-ui hover:bg-plate/10 hover:text-blueberry"
                >
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${
                      item.isCompletedInRoutine ? 'text-status-nominal' : 'text-stem/70'
                    }`}
                    aria-hidden="true"
                  />
                  {item.isCompletedInRoutine ? 'Undo in routine' : 'Mark done in routine'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Shielding Posture & SPE Storm Drill Decision Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/50 bg-canvas/40 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <span className="twin-label shrink-0">Shielding posture</span>
          <div
            role="radiogroup"
            aria-label="Habitat shielding posture"
            className="twin-segmented min-w-[260px] flex-1 max-w-md"
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
                  <span className="hidden text-[10px] font-normal opacity-75 sm:inline">{opt.spec}</span>
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
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-ui ${
            value.rehearseSolarStorm
              ? 'border-status-critical/60 bg-status-critical/15 text-status-critical'
              : 'border-line/70 bg-canvas/60 text-stem hover:text-blueberry'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Rehearse S4 solar storm
        </button>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
        <p className="text-xs text-stem" aria-live="polite">
          {isEvaluating
            ? 'Evaluating clinical triage…'
            : isDirty
              ? 'Decision scenario changed since the last triage.'
              : 'Triage is up to date with this decision plan.'}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            disabled={(!value.active && !hasDecisions) || isEvaluating}
            className="twin-btn twin-btn-ghost"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset plan
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
