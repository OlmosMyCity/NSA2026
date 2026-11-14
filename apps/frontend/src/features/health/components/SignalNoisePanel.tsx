'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  Radio,
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

const SOURCE_LABELS: Record<BiodosimetryTriageResult['source'], string> = {
  'backend-bridge': 'API Bridge + ML',
  'signal-noise-fastapi': 'FastAPI ML Engine',
  'local-simulation': 'Simulación Local Calibrada',
};

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
          label: 'Radiación Ionizante (HZE / SPE)',
          pct: triage.attribution.ionizingRadiationPct,
          barClass: 'bg-rose-500',
          textClass: 'text-rose-300',
        },
        {
          label: 'Microgravedad / Cambio de Fluidos',
          pct: triage.attribution.microgravityStressPct,
          barClass: 'bg-amber-400',
          textClass: 'text-amber-300',
        },
        {
          label: 'Privación de Sueño / Estrés Psicológico',
          pct: triage.attribution.sleepPsychStressPct,
          barClass: 'bg-cyan-400',
          textClass: 'text-cyan-300',
        },
        {
          label: 'Línea Base Nominal',
          pct: triage.attribution.nominalPct,
          barClass: 'bg-emerald-400',
          textClass: 'text-emerald-300',
        },
      ]
    : [];

  return (
    <section
      aria-label="Signal vs. Noise Attribution"
      className="rounded-2xl border border-white/10 bg-space-950/60 p-5 sm:p-6 backdrop-blur-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-telemetry-cyan">
            <Cpu className="h-4 w-4" aria-hidden="true" />
            <span>Signal vs. Noise Attribution · Biodosimetría</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Fusión de Sensores: Radiación vs. Ruido Fisiológico
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Separa daño genotóxico real (γ-H2AX / FDXR) de estrés oxidativo por sueño o microgravedad (8-OHdG).
          </p>
        </div>

        {result && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-300">
            <Radio className="h-3 w-3 text-telemetry-cyan" aria-hidden="true" />
            {SOURCE_LABELS[result.source]}
          </span>
        )}
      </div>

      {/* Controles de Simulación */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-telemetry-cyan" aria-hidden="true" />
            Escenario:
          </span>
          <button
            type="button"
            onClick={() => setScenario('LIVE_READING')}
            className={`rounded-lg px-2.5 py-1.5 font-mono text-xs transition ${
              scenario === 'LIVE_READING'
                ? 'border border-telemetry-cyan/60 bg-telemetry-cyan/15 text-telemetry-cyan'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/25'
            }`}
          >
            Lectura Actual
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
              className={`rounded-lg px-2.5 py-1.5 font-mono text-xs transition ${
                scenario === key
                  ? 'border border-telemetry-cyan/60 bg-telemetry-cyan/15 text-telemetry-cyan'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/25'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="shielding-select" className="text-xs font-mono text-slate-400">
            Blindaje:
          </label>
          <select
            id="shielding-select"
            value={shielding}
            onChange={(e) => setShielding(e.target.value as ShieldingType)}
            className="rounded-lg border border-white/15 bg-space-950 px-2.5 py-1.5 font-mono text-xs text-white focus:border-telemetry-cyan focus:outline-none"
          >
            {SHIELDING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado de Alerta / Falsa Alarma */}
      {triage && (
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            isGenotoxicAlert
              ? 'border-rose-500/40 bg-rose-500/10'
              : isFalsePositiveFiltered
              ? 'border-amber-400/40 bg-amber-400/10'
              : 'border-emerald-400/30 bg-emerald-400/10'
          }`}
        >
          <div className="flex items-start gap-3">
            {isGenotoxicAlert ? (
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
            ) : isFalsePositiveFiltered ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-mono text-xs font-bold uppercase tracking-wider ${
                    isGenotoxicAlert
                      ? 'text-rose-300'
                      : isFalsePositiveFiltered
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  {isGenotoxicAlert
                    ? 'Alerta Genotóxica Real'
                    : isFalsePositiveFiltered
                    ? 'Falsa Alarma Filtrada (Ruido Fisiológico)'
                    : 'Sin Riesgo Genotóxico Agudo'}
                </span>
                <span className="rounded bg-black/30 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  Confianza: {(triage.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-200">{triage.explanation}</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 font-mono text-[11px] text-slate-300">
            <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              Dosis: {activePayload.doseRateMicroSvPerHour.toFixed(0)} µSv/h
            </span>
            <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              γ-H2AX: {activePayload.gammaH2axFociPerCell.toFixed(1)} foci
            </span>
            <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
              8-OHdG: {activePayload.urine8OhdgNgMg.toFixed(1)} ng/mg
            </span>
          </div>
        </div>
      )}

      {/* Barras de Atribución Causal */}
      <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-telemetry-cyan" aria-hidden="true" />
              Atribución Causal del Modelo
            </span>
            {isLoading && <span className="text-telemetry-cyan">Analizando...</span>}
          </div>

          <div className="space-y-2.5">
            {bars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{bar.label}</span>
                  <span className={`font-mono font-semibold ${bar.textClass}`}>
                    {bar.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${bar.barClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendaciones Clínicas Diferenciadas */}
        {triage && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-telemetry-cyan">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <span>Conducta Clínica Diferenciada</span>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
              {triage.clinicalGuidance.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-telemetry-cyan" />
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
