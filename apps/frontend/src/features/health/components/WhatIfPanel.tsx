'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type {
  MissionEnvironment,
  NOAAStormScale,
  ShieldingType,
} from '../services/digitalTwinService';

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

interface WhatIfPanelProps {
  value: WhatIfState;
  onChange: (next: WhatIfState) => void;
  onReset: () => void;
}

export function WhatIfPanel({ value, onChange, onReset }: WhatIfPanelProps) {
  const update = (patch: Partial<WhatIfState>) =>
    onChange({ ...value, ...patch, active: true });

  return (
    <section
      aria-label="What-If Simulation Mode"
      className={`surface-card p-5 space-y-4 ${value.active ? 'ring-2 ring-berry/50' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-berry" aria-hidden="true" />
          <h2 className="text-sm font-bold text-blueberry">
            What-If Simulator
          </h2>
          {value.active && (
            <span className="rounded-pill bg-berry/15 px-2.5 py-0.5 text-[11px] font-semibold text-berry">
              Simulation Active (No DB write)
            </span>
          )}
        </div>

        {value.active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-pill border border-black/10 px-3 py-1 text-xs font-medium text-blueberry hover:bg-surface-tinted"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-medium text-stem">Environment</span>
          <select
            value={value.environment}
            onChange={(e) => update({ environment: e.target.value as MissionEnvironment })}
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          >
            <option value="SPACECRAFT">Spacecraft (Orion)</option>
            <option value="STATION">Space Station</option>
            <option value="ROVER">Surface Rover</option>
            <option value="LUNAR_BASE">Lunar Base</option>
            <option value="MARS_BASE">Mars Base</option>
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-stem">Solar Storm (NOAA)</span>
          <select
            value={value.stormScale}
            onChange={(e) => update({ stormScale: e.target.value as NOAAStormScale })}
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          >
            <option value="S0_NOMINAL">S0 Nominal</option>
            <option value="S2_MODERATE">S2 Moderate</option>
            <option value="S3_STRONG">S3 Strong</option>
            <option value="S4_SEVERE">S4 Severe</option>
            <option value="S5_EXTREME">S5 Extreme</option>
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-stem">Shielding</span>
          <select
            value={value.shielding}
            onChange={(e) => update({ shielding: e.target.value as ShieldingType })}
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          >
            <option value="EVA_SUIT">EVA Suit (1.2 g/cm²)</option>
            <option value="CREW_CABIN_NOMINAL">Crew Cabin (10 g/cm²)</option>
            <option value="STORM_SHELTER">Storm Shelter (25 g/cm²)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-medium text-stem">Heart Rate (bpm)</span>
          <input
            type="number"
            min={30}
            max={200}
            placeholder="Use latest"
            value={value.heartRateBpm ?? ''}
            onChange={(e) =>
              update({ heartRateBpm: e.target.value ? Number(e.target.value) : undefined })
            }
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-stem">SpO₂ (%)</span>
          <input
            type="number"
            min={70}
            max={100}
            placeholder="Use latest"
            value={value.spo2Pct ?? ''}
            onChange={(e) =>
              update({ spo2Pct: e.target.value ? Number(e.target.value) : undefined })
            }
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-stem">Sleep (h/day)</span>
          <input
            type="number"
            min={0}
            max={16}
            step={0.5}
            placeholder="Use latest"
            value={value.sleepHours ?? ''}
            onChange={(e) =>
              update({ sleepHours: e.target.value ? Number(e.target.value) : undefined })
            }
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-stem">Mood Note (optional)</span>
          <input
            type="text"
            placeholder="e.g., Feeling isolated..."
            value={value.freeTextMood}
            onChange={(e) => update({ freeTextMood: e.target.value })}
            className="mt-1 w-full rounded-md border border-black/10 bg-surface px-2.5 py-1.5 text-xs text-blueberry"
          />
        </label>
      </div>
    </section>
  );
}

