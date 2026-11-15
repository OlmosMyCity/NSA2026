'use client';

/**
 * @module health/components/SignalNoisePanel
 * Radiobiological Signal-vs.-Noise attribution panel.
 * Combines physical dosimetry (`doseRateMicroSvPerHour`, NOAA storm scale,
 * structural shielding) with molecular biomarkers (`γ-H2AX`, `FDXR`, urinary
 * `8-OHdG`) and vitals to separate acute ionizing radiation exposure from
 * oxidative stress caused by sleep deprivation or microgravity fluid shifts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { ApiHealthReading } from '../domain/api-adapter';
import {
  biodosimetryService,
  BiodosimetryTriageResult,
  buildPayloadFromReading,
  ShieldingType,
  SIMULATION_PRESETS,
  SimulationScenarioKey,
} from '../services/biodosimetryService';

interface SignalNoisePanelProps {
  astronautId?: string;
  latestReading?: Partial<ApiHealthReading> | null;
  compact?: boolean;
}

const SHIELDING_OPTIONS: { value: ShieldingType; label: string }[] = [
  { value: 'EVA_SUIT', label: 'EVA Suit' },
  { value: 'CREW_CABIN_NOMINAL', label: 'Crew Cabin' },
  { value: 'STORM_SHELTER', label: 'Storm Shelter' },
];

export function SignalNoisePanel({
  astronautId,
  latestReading,
  compact = false,
}: SignalNoisePanelProps) {
  const [scenario, setScenario] = useState<SimulationScenarioKey>('LIVE_READING');
  const [shielding, setShielding] = useState<ShieldingType>('CREW_CABIN_NOMINAL');
  const [result, setResult] = useState<BiodosimetryTriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activePayload = useMemo(() => {
    if (scenario === 'LIVE_READING') {
      return buildPayloadFromReading(latestReading, shielding);
    }
    return {
      ...SIMULATION_PRESETS[scenario].payload,
      shieldingType: shielding,
    };
  }, [latestReading, scenario, shielding]);

  const evaluate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await biodosimetryService.runTriage({
        astronautId,
        shieldingType: shielding,
        payload: activePayload,
        useLiveBridge: scenario === 'LIVE_READING',
      });
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  }, [activePayload, astronautId, scenario, shielding]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const triage = result?.triage;
  const isGenotoxicAlert = triage?.primaryCause === 'IONIZING_RADIATION';
  const isFalsePositiveFiltered = Boolean(triage?.falsePositiveFiltered);

  const bars = triage
    ? [
        {
          label: 'Ionizing Radiation (HZE / SPE)',
          pct: triage.attribution.ionizingRadiationPct,
          barClass: 'bg-status-critical',
          textClass: 'text-status-critical',
        },
        {
          label: 'Microgravity / Fluid Shift',
          pct: triage.attribution.microgravityStressPct,
          barClass: 'bg-status-caution',
          textClass: 'text-status-caution',
        },
        {
          label: 'Sleep Deprivation / Psych Stress',
          pct: triage.attribution.sleepPsychStressPct,
          barClass: 'bg-berry',
          textClass: 'text-berry',
        },
        {
          label: 'Nominal Baseline',
          pct: triage.attribution.nominalPct,
          barClass: 'bg-status-nominal',
          textClass: 'text-status-nominal',
        },
      ]
    : [];

  return (
    <section
      aria-label="Signal vs. Noise Attribution"
      className="surface-card p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-berry">
            <Cpu className="h-4 w-4" aria-hidden="true" />
            <span>Signal vs. Noise Attribution · Biodosimetry</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-blueberry">
            Sensor Fusion: Radiation vs. Physiological Noise
          </h2>
          <p className="mt-0.5 text-xs text-stem">
            Separates true genotoxic DNA damage (γ-H2AX / FDXR) from oxidative stress caused by sleep loss or microgravity (8-OHdG).
          </p>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-stem mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
            Scenario:
          </span>
          <button
            type="button"
            onClick={() => setScenario('LIVE_READING')}
            className={`tactile-press rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
              scenario === 'LIVE_READING'
                ? 'border border-berry bg-surface-hover text-blueberry font-semibold'
                : 'border border-line text-stem hover:text-blueberry'
            }`}
          >
            Live Reading
          </button>
          {(
            Object.entries(SIMULATION_PRESETS) as [
              Exclude<SimulationScenarioKey, 'LIVE_READING'>,
              (typeof SIMULATION_PRESETS)[Exclude<SimulationScenarioKey, 'LIVE_READING'>],
            ][]
          ).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setScenario(key);
                setShielding(preset.payload.shieldingType);
              }}
              className={`tactile-press rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
                scenario === key
                  ? 'border border-berry bg-surface-hover text-blueberry font-semibold'
                  : 'border border-line text-stem hover:text-blueberry'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="shielding-select" className="text-xs font-mono text-stem">
            Shielding:
          </label>
          <select
            id="shielding-select"
            value={shielding}
            onChange={(e) => setShielding(e.target.value as ShieldingType)}
            className="rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs text-blueberry focus:border-berry focus:outline-none"
          >
            {SHIELDING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Model Input Telemetry Traceability */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-[11px]">
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">Dose Rate</span>
          <span className="text-blueberry font-semibold tabular-nums">
            {activePayload.doseRateMicroSvPerHour.toFixed(0)} µSv/h
          </span>
        </div>
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">Storm Scale</span>
          <span className="text-blueberry font-semibold tabular-nums">
            S{activePayload.stormScaleLevel}
          </span>
        </div>
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">γ-H2AX</span>
          <span className="text-blueberry font-semibold tabular-nums">
            {activePayload.gammaH2axFociPerCell.toFixed(1)} foci
          </span>
        </div>
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">FDXR Fold</span>
          <span className="text-blueberry font-semibold tabular-nums">
            {activePayload.fdxrFoldChange.toFixed(2)}×
          </span>
        </div>
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">8-OHdG</span>
          <span className="text-blueberry font-semibold tabular-nums">
            {activePayload.urine8OhdgNgMg.toFixed(1)} ng/mg
          </span>
        </div>
        <div className="rounded-md border border-line bg-surface-subtle px-2.5 py-1.5">
          <span className="block text-stem">Sleep / HR</span>
          <span className="text-blueberry font-semibold tabular-nums">
            {activePayload.sleepHours.toFixed(1)}h · {activePayload.heartRateBpm} bpm
          </span>
        </div>
      </div>

      {/* Alert / False-Positive Filter Status */}
      {triage && (
        <div
          className={`flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between ${
            isGenotoxicAlert
              ? 'border-[var(--status-critical-border)] bg-[var(--status-critical-bg)]'
              : isFalsePositiveFiltered
                ? 'border-[var(--status-caution-border)] bg-[var(--status-caution-bg)]'
                : 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)]'
          }`}
        >
          <div className="flex items-start gap-3">
            {isGenotoxicAlert ? (
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" aria-hidden="true" />
            ) : isFalsePositiveFiltered ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-caution" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-nominal" aria-hidden="true" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-mono text-xs font-bold uppercase tracking-wider ${
                    isGenotoxicAlert
                      ? 'text-status-critical'
                      : isFalsePositiveFiltered
                        ? 'text-status-caution'
                        : 'text-status-nominal'
                  }`}
                >
                  {isGenotoxicAlert
                    ? 'Confirmed Genotoxic Radiation Alert'
                    : isFalsePositiveFiltered
                      ? 'False Positive Filtered (Physiological Noise)'
                      : 'No Acute Genotoxic Risk'}
                </span>
                <span className="rounded-md border border-line bg-canvas/70 px-2 py-0.5 font-mono text-[11px] text-blueberry tabular-nums">
                  Confidence: {(triage.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-blueberry">{triage.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Attribution Bars & Clinical Guidance */}
      <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-stem">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              Causal Attribution Breakdown
            </span>
            {isLoading && <span className="text-berry">Evaluating…</span>}
          </div>

          <div className="space-y-2.5">
            {bars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-blueberry">{bar.label}</span>
                  <span className={`font-mono font-semibold tabular-nums ${bar.textClass}`}>
                    {bar.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-sm bg-surface-subtle">
                  <div
                    className={`h-full transition-all duration-500 ${bar.barClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {triage && (
          <div className="rounded-md border border-line bg-surface-subtle p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-berry">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <span>Differentiated Clinical Protocol</span>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-blueberry">
              {triage.clinicalGuidance.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-berry" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
