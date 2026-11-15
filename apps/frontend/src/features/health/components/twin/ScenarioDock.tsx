'use client';

import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import type {
  MissionEnvironment,
  NOAAStormScale,
  ShieldingType,
} from '../../services/digitalTwinService';
import { ThresholdSlider } from './ThresholdSlider';

export interface WhatIfState {
  active: boolean;
  environment: MissionEnvironment;
  stormScale: NOAAStormScale;
  shielding: ShieldingType;
  heartRateBpm?: number;
  spo2Pct?: number;
  sleepHours?: number;
  freeTextMood: string;
}

export const INITIAL_WHAT_IF: WhatIfState = {
  active: false,
  environment: 'LUNAR_BASE',
  stormScale: 'S0_NOMINAL',
  shielding: 'CREW_CABIN_NOMINAL',
  freeTextMood: '',
};

export interface ScenarioBaseline {
  heartRateBpm: number;
  spo2Pct: number;
  sleepHours: number;
}

interface ScenarioDockProps {
  value: WhatIfState;
  baseline: ScenarioBaseline | null;
  isEvaluating: boolean;
  isDirty: boolean;
  onChange: (next: WhatIfState) => void;
  onRun: () => void;
  onReset: () => void;
}

const ENVIRONMENTS: { value: MissionEnvironment; label: string }[] = [
  { value: 'SPACECRAFT', label: 'Orion spacecraft' },
  { value: 'STATION', label: 'Space station' },
  { value: 'LUNAR_BASE', label: 'Lunar base' },
  { value: 'ROVER', label: 'Pressurized rover' },
  { value: 'MARS_BASE', label: 'Mars base' },
];

const STORMS: { value: NOAAStormScale; label: string }[] = [
  { value: 'S0_NOMINAL', label: 'S0 · Quiet sun' },
  { value: 'S1_MINOR', label: 'S1 · Minor' },
  { value: 'S2_MODERATE', label: 'S2 · Moderate' },
  { value: 'S3_STRONG', label: 'S3 · Strong' },
  { value: 'S4_SEVERE', label: 'S4 · Severe' },
  { value: 'S5_EXTREME', label: 'S5 · Extreme' },
];

const SHIELDING: { value: ShieldingType; label: string }[] = [
  { value: 'EVA_SUIT', label: 'EVA suit · 1.2 g/cm²' },
  { value: 'CREW_CABIN_NOMINAL', label: 'Crew cabin · 10 g/cm²' },
  { value: 'STORM_SHELTER', label: 'Storm shelter · 25 g/cm²' },
];

const FALLBACK: ScenarioBaseline = { heartRateBpm: 72, spo2Pct: 98, sleepHours: 7.5 };

export function ScenarioDock({
  value,
  baseline,
  isEvaluating,
  isDirty,
  onChange,
  onRun,
  onReset,
}: ScenarioDockProps) {
  const base = baseline ?? FALLBACK;
  const update = (patch: Partial<WhatIfState>) => onChange({ ...value, ...patch, active: true });

  return (
    <section aria-labelledby="scenario-title" className="twin-panel p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 id="scenario-title" className="text-sm font-semibold text-blueberry">
            What-if scenario
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              value.active ? 'bg-status-caution/15 text-status-caution' : 'bg-plate/5 text-stem'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${value.active ? 'bg-status-caution' : 'bg-status-nominal'}`}
            />
            {value.active ? 'Simulating' : baseline ? 'Showing last reading' : 'Baseline values'}
          </span>
        </div>
      </header>

      <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
        <div className="space-y-4">
          <ThresholdSlider
            indicator="heartRate"
            domain={[35, 150]}
            value={value.heartRateBpm ?? base.heartRateBpm}
            baseline={baseline?.heartRateBpm}
            onChange={(v) => update({ heartRateBpm: v })}
          />
          <ThresholdSlider
            indicator="spo2"
            domain={[80, 100]}
            value={value.spo2Pct ?? base.spo2Pct}
            baseline={baseline?.spo2Pct}
            onChange={(v) => update({ spo2Pct: v })}
          />
          <ThresholdSlider
            indicator="sleepHours"
            domain={[0, 12]}
            value={value.sleepHours ?? base.sleepHours}
            baseline={baseline?.sleepHours}
            onChange={(v) => update({ sleepHours: v })}
          />
        </div>

        <div className="grid grid-cols-2 content-start gap-3">
          <label className="col-span-2 block space-y-1.5">
            <span className="twin-label">Environment</span>
            <select
              value={value.environment}
              onChange={(e) => update({ environment: e.target.value as MissionEnvironment })}
              className="twin-select"
            >
              {ENVIRONMENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="twin-label">Solar storm (NOAA)</span>
            <select
              value={value.stormScale}
              onChange={(e) => update({ stormScale: e.target.value as NOAAStormScale })}
              className="twin-select"
            >
              {STORMS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="twin-label">Shielding</span>
            <select
              value={value.shielding}
              onChange={(e) => update({ shielding: e.target.value as ShieldingType })}
              className="twin-select"
            >
              {SHIELDING.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block space-y-1.5">
            <span className="twin-label">Crew note (optional)</span>
            <input
              type="text"
              maxLength={280}
              placeholder="e.g. Feeling isolated, slept badly after the EVA"
              value={value.freeTextMood}
              onChange={(e) => update({ freeTextMood: e.target.value })}
              className="twin-select placeholder:text-stem/70"
            />
          </label>
        </div>
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
        <p className="text-xs text-stem" aria-live="polite">
          {isEvaluating
            ? 'Evaluating clinical triage…'
            : isDirty
              ? 'Scenario changed since the last triage.'
              : 'Triage is up to date with this scenario.'}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            disabled={!value.active || isEvaluating}
            className="twin-btn twin-btn-ghost"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Back to last reading
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
            Run triage
          </button>
        </div>
      </footer>
    </section>
  );
}

