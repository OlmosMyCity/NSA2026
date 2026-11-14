'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  Shield,
  ShieldAlert,
  Square,
} from 'lucide-react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { OrbitTrajectoryViewer } from '@/features/visualizer/components/OrbitTrajectoryViewer';
import { MolecularTwinSection } from '@/features/visualizer/components/MolecularTwinSection';
import type { ScenarioId, ShieldingType } from '@/features/visualizer/services/biophysicsService';

const MASTER_SCENARIOS: {
  id: ScenarioId;
  label: string;
  badge: string;
  directive: string;
  tone: 'nominal' | 'caution' | 'critical';
}[] = [
  {
    id: 'NOMINAL',
    label: 'Nominal (S0)',
    badge: 'S0 NOMINAL · G0',
    directive: 'Quiet solar wind (~410 km/s). Standard EVA & NRHO operations cleared.',
    tone: 'nominal',
  },
  {
    id: 'FLARE_EARLY_WARNING',
    label: 'X4.5 Flare Warning',
    badge: 'EARLY WARNING',
    directive: 'X4.5 flare at N14W42 targeting cislunar corridor. Abort EVA & transition to shelter.',
    tone: 'caution',
  },
  {
    id: 'PEAK_STORM_S4',
    label: 'Peak Storm (S4)',
    badge: 'S4 SEVERE · G5 SHOCK',
    directive: 'Extreme SPE & solar wind (1,120 km/s). Mandatory Storm Shelter & radioprotector protocol.',
    tone: 'critical',
  },
];

const BRIEFING_STEPS = [
  {
    title: '1/4 · Macro: Solar Flare & Parker Spiral (3D)',
    summary:
      'X4.5 flare erupts at N14W42 along the Parker spiral footpoint. 3D scene shows accelerated solar wind, compressed magnetosphere, and CME shockfront.',
  },
  {
    title: '2/4 · Early Warning: 48-Min Relativistic Lead Time',
    summary:
      'X-rays arrive in 8.3 min; 100 MeV protons take ~56 min along the curved Parker spiral — giving Gateway & Orion a 48-min evacuation window.',
  },
  {
    title: '3/4 · Shelter Cascade: -95% Dose & DNA Repair Recovery',
    summary:
      'Executing Storm Shelter activates the 3D protective halo and drops γ-H2AX double-strand breaks below repair saturation in the ODE twin.',
  },
  {
    title: '4/4 · Nano: KEAP1 Radioprotector Binding Pocket',
    summary:
      'Focusing ARG415 in the 3D molecular twin shows how α-Tocopherol / NAC stabilizes Nrf2 antioxidant defense during solar particle events.',
  },
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `T-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VisualizerPage() {
  const [masterScenario, setMasterScenario] = useState<ScenarioId>('FLARE_EARLY_WARNING');
  const [shielding, setShielding] = useState<ShieldingType>('EVA_SUIT');
  const [focusedResidue, setFocusedResidue] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState(48 * 60);

  // NASA Briefing Tour state
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourPlaying, setTourPlaying] = useState(false);

  const orbitRef = useRef<HTMLDivElement>(null);
  const molecularRef = useRef<HTMLDivElement>(null);

  // Live ticking SEP Early Warning countdown
  useEffect(() => {
    if (masterScenario !== 'FLARE_EARLY_WARNING') {
      setCountdownSec(masterScenario === 'PEAK_STORM_S4' ? 0 : 48 * 60);
      return;
    }
    setCountdownSec(48 * 60);
    const id = setInterval(() => {
      setCountdownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [masterScenario]);

  // Apply tour step effects across all 3 models
  useEffect(() => {
    if (tourStep === null) return;
    if (tourStep === 0) {
      setMasterScenario('FLARE_EARLY_WARNING');
      setShielding('EVA_SUIT');
      setFocusedResidue(null);
      orbitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tourStep === 1) {
      setMasterScenario('FLARE_EARLY_WARNING');
      orbitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (tourStep === 2) {
      setMasterScenario('PEAK_STORM_S4');
      setShielding('STORM_SHELTER');
      molecularRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tourStep === 3) {
      setMasterScenario('PEAK_STORM_S4');
      setShielding('STORM_SHELTER');
      setFocusedResidue('ARG415');
      molecularRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [tourStep]);

  // Auto-advance tour when playing
  useEffect(() => {
    if (!tourPlaying || tourStep === null) return;
    const id = setTimeout(() => {
      if (tourStep < BRIEFING_STEPS.length - 1) {
        setTourStep(tourStep + 1);
      } else {
        setTourPlaying(false);
      }
    }, 6500);
    return () => clearTimeout(id);
  }, [tourPlaying, tourStep]);

  const activeMeta = MASTER_SCENARIOS.find((s) => s.id === masterScenario) ?? MASTER_SCENARIOS[0];
  const shelterActive = shielding === 'STORM_SHELTER';

  const bannerClasses = shelterActive && masterScenario !== 'NOMINAL'
    ? 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)]'
    : activeMeta.tone === 'critical'
      ? 'border-[var(--status-critical-border)] bg-[var(--status-critical-bg)]'
      : activeMeta.tone === 'caution'
        ? 'border-[var(--status-caution-border)] bg-[var(--status-caution-bg)]'
        : 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)]';

  const badgeTextClass = shelterActive && masterScenario !== 'NOMINAL'
    ? 'text-status-nominal'
    : activeMeta.tone === 'critical'
      ? 'text-status-critical'
      : activeMeta.tone === 'caution'
        ? 'text-status-caution'
        : 'text-status-nominal';

  return (
    <AppLayout>
      <div className="py-6 sm:py-8 space-y-6">
        <div className="border-b border-line pb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
              3D Mission Orbit &amp; Biophysics Visualizer
            </h1>
            <p className="mt-1.5 text-sm text-stem max-w-2xl">
              Unified Artemis IV cislunar trajectory, solar wind impact prediction, and molecular DNA
              repair kinetics synchronized to a single space weather event.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (tourStep === null) {
                  setTourStep(0);
                  setTourPlaying(true);
                } else {
                  setTourPlaying(false);
                  setTourStep(null);
                }
              }}
              className={`tactile-press inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs transition ${
                tourStep !== null
                  ? 'border-berry bg-surface-hover text-blueberry font-semibold'
                  : 'border-line text-berry hover:border-berry hover:text-blueberry'
              }`}
            >
              {tourStep !== null ? (
                <>
                  <Square className="h-3 w-3" aria-hidden="true" />
                  <span>Stop Briefing</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" aria-hidden="true" />
                  <span>Play NASA Briefing</span>
                </>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Master Space Weather Scenario">
              {MASTER_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setMasterScenario(sc.id)}
                  className={`tactile-press rounded-md px-3 py-1.5 font-mono text-xs transition ${
                    masterScenario === sc.id
                      ? 'border border-berry bg-surface-hover text-blueberry font-semibold'
                      : 'border border-line text-stem hover:text-blueberry'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Narrated 4-Step NASA Briefing Bar */}
        {tourStep !== null && (
          <div className="surface-card border-berry p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="font-mono text-xs font-semibold text-berry uppercase tracking-wider">
                {BRIEFING_STEPS[tourStep].title}
              </div>
              <p className="text-xs text-blueberry leading-relaxed">
                {BRIEFING_STEPS[tourStep].summary}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs">
              <button
                type="button"
                disabled={tourStep === 0}
                onClick={() => {
                  setTourPlaying(false);
                  setTourStep(Math.max(0, tourStep - 1));
                }}
                className="tactile-press rounded-md border border-line p-1.5 text-blueberry disabled:opacity-40"
                aria-label="Previous step"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTourPlaying(!tourPlaying)}
                className="tactile-press rounded-md border border-line px-2.5 py-1 text-blueberry"
              >
                {tourPlaying ? 'Pause' : 'Auto'}
              </button>
              <button
                type="button"
                disabled={tourStep === BRIEFING_STEPS.length - 1}
                onClick={() => {
                  setTourPlaying(false);
                  setTourStep(Math.min(BRIEFING_STEPS.length - 1, tourStep + 1));
                }}
                className="tactile-press rounded-md border border-line p-1.5 text-blueberry disabled:opacity-40"
                aria-label="Next step"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Persistent Mission Control Space Weather Directive */}
        <div
          role="status"
          className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${bannerClasses}`}
        >
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {shelterActive && masterScenario !== 'NOMINAL' ? (
              <Shield className="h-4 w-4 shrink-0 text-status-nominal" aria-hidden="true" />
            ) : activeMeta.tone === 'critical' ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-status-critical" aria-hidden="true" />
            ) : activeMeta.tone === 'caution' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-status-caution" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-nominal" aria-hidden="true" />
            )}

            <span className={`font-mono font-bold tracking-wider ${badgeTextClass}`}>
              {shelterActive && masterScenario !== 'NOMINAL'
                ? 'STORM SHELTER ACTIVE (-95% DOSE)'
                : activeMeta.badge}
            </span>

            {masterScenario === 'FLARE_EARLY_WARNING' && (
              <span className="rounded border border-line bg-canvas/70 px-2 py-0.5 font-mono font-bold text-status-caution tabular-nums">
                SEP ETA {formatCountdown(countdownSec)}
              </span>
            )}

            <span className="text-blueberry">
              {shelterActive && masterScenario !== 'NOMINAL'
                ? 'Crew secured inside Storm Shelter. 3D protective halo & DNA repair recovery active.'
                : activeMeta.directive}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShielding(shelterActive ? 'EVA_SUIT' : 'STORM_SHELTER')}
              className={`tactile-press inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-xs font-semibold transition ${
                shelterActive
                  ? 'border-[var(--status-nominal-border)] bg-canvas/80 text-status-nominal'
                  : 'border-berry bg-surface-hover text-blueberry hover:opacity-90'
              }`}
            >
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              {shelterActive ? 'Exit Storm Shelter' : 'Execute Shelter Protocol'}
            </button>
          </div>
        </div>

        <div ref={orbitRef}>
          <OrbitTrajectoryViewer
            scenario={masterScenario}
            onScenarioChange={setMasterScenario}
            shelterActive={shelterActive}
          />
        </div>

        <div ref={molecularRef}>
          <MolecularTwinSection
            scenario={masterScenario}
            onScenarioChange={setMasterScenario}
            shielding={shielding}
            onShieldingChange={setShielding}
            focusedResidue={focusedResidue}
            onFocusedResidueChange={setFocusedResidue}
          />
        </div>
      </div>
    </AppLayout>
  );
}
