'use client';

import { useEffect, useState } from 'react';
import { Atom, Dna, ShieldAlert, ShieldCheck, FlaskConical } from 'lucide-react';
import {
  biophysicsService,
  BiophysicsScenarioResponse,
  ScenarioId,
  ShieldingType,
} from '../services/biophysicsService';
import { MoleculeViewer3D } from './MoleculeViewer3D';
import { KineticsChart } from './KineticsChart';

const SCENARIO_OPTIONS: { id: ScenarioId; label: string }[] = [
  { id: 'NOMINAL', label: 'Nominal (S0)' },
  { id: 'FLARE_EARLY_WARNING', label: 'X4.5 Flare Warning' },
  { id: 'PEAK_STORM_S4', label: 'Peak Storm (S4)' },
];

const SHIELDING_OPTIONS: { id: ShieldingType; label: string }[] = [
  { id: 'EVA_SUIT', label: 'EVA Suit' },
  { id: 'CREW_CABIN_NOMINAL', label: 'Crew Cabin' },
  { id: 'STORM_SHELTER', label: 'Storm Shelter' },
];

interface MolecularTwinSectionProps {
  scenario?: ScenarioId;
  onScenarioChange?: (next: ScenarioId) => void;
  shielding?: ShieldingType;
  onShieldingChange?: (next: ShieldingType) => void;
  focusedResidue?: string | null;
  onFocusedResidueChange?: (next: string | null) => void;
}

export function MolecularTwinSection({
  scenario: controlledScenario,
  onScenarioChange,
  shielding: controlledShielding,
  onShieldingChange,
  focusedResidue: controlledResidue,
  onFocusedResidueChange,
}: MolecularTwinSectionProps) {
  const [internalScenario, setInternalScenario] = useState<ScenarioId>('PEAK_STORM_S4');
  const scenario = controlledScenario ?? internalScenario;
  const setScenario = onScenarioChange ?? setInternalScenario;

  const [internalShielding, setInternalShielding] = useState<ShieldingType>('EVA_SUIT');
  const shielding = controlledShielding ?? internalShielding;
  const setShielding = onShieldingChange ?? setInternalShielding;

  const [data, setData] = useState<BiophysicsScenarioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedComplexId, setSelectedComplexId] = useState<string>('keap1_tocopherol');
  const [internalResidue, setInternalResidue] = useState<string | null>(null);
  const focusedResidue = controlledResidue !== undefined ? controlledResidue : internalResidue;
  const setFocusedResidue = onFocusedResidueChange ?? setInternalResidue;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setIsLoading(true);
    biophysicsService
      .getScenario(scenario)
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Unable to load biophysics data.');
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scenario]);

  const activeComplex =
    data?.dockingEvidence.find((c) => c.id === selectedComplexId) ?? data?.dockingEvidence[0];

  const pdbUrl = activeComplex
    ? activeComplex.structureFile.includes('1JEY_ku70_ku80_clustered_hze')
      ? '/biophysics/structures/1JEY.pdb'
      : `/biophysics/${activeComplex.structureFile}`
    : '/biophysics/structures/4IQK_keap1_tocopherol_docked.pdb';

  const activeShielding = data?.shieldingResults[shielding];

  return (
    <section className="mt-10 border-t border-line pt-8 space-y-6" aria-label="Molecular Twin">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-berry">
            <Dna className="h-4 w-4" aria-hidden="true" />
            <span>Biophysics Twin · Molecular Docking &amp; DNA Repair Kinetics</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-blueberry">
            DNA Repair Kinetics &amp; Radioprotector Docking
          </h2>
          <p className="mt-1 text-sm text-stem max-w-2xl">
            Molecular radioprotector interactions and γ-H2AX / 8-OHdG biomarker kinetics
            synchronized with the active space weather scenario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoading && (
            <span className="font-mono text-xs text-berry mr-1">Updating…</span>
          )}
          {SCENARIO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScenario(opt.id)}
              className={`tactile-press rounded-md px-3 py-1.5 font-mono text-xs transition ${
                scenario === opt.id
                  ? 'border border-berry bg-surface-hover text-blueberry font-semibold'
                  : 'border border-line text-stem hover:text-blueberry'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="surface-card border-[var(--status-critical-border)] p-4 text-sm text-status-critical"
        >
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Takeaway Banner */}
          <div className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {activeShielding?.isRepairSaturated ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" aria-hidden="true" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-status-nominal" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium text-blueberry">{data.astronautTakeaway}</p>
                <p className="mt-0.5 text-xs text-stem">{data.description}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 font-mono text-xs">
              <span className="rounded-md border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] px-2.5 py-1 text-status-nominal">
                Dose -{data.doseReductionShelterVsEvaPct.toFixed(1)}% (Shelter)
              </span>
              <span className="rounded-md border border-line bg-surface-subtle px-2.5 py-1 text-berry">
                γ-H2AX -{data.gammaH2axReductionShelterVsEvaPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: 3D Molecular Docking Viewer */}
            <div className="surface-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blueberry">
                  <Atom className="h-4 w-4 text-berry" aria-hidden="true" />
                  3D Molecular Complex
                </h3>
                {activeComplex && (
                  <span
                    title="More negative ΔG indicates stronger radioprotector binding affinity"
                    className="font-mono text-xs rounded-md bg-[var(--status-nominal-bg)] border border-[var(--status-nominal-border)] px-2 py-0.5 text-status-nominal"
                  >
                    ΔG = {activeComplex.bindingAffinityKcalMol.toFixed(2)} kcal/mol (stronger if &lt; -7)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {data.dockingEvidence.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedComplexId(item.id);
                      setFocusedResidue(null);
                    }}
                    className={`tactile-press rounded-md px-2.5 py-1 font-mono text-[11px] transition ${
                      activeComplex?.id === item.id
                        ? 'border border-berry bg-surface-hover text-blueberry font-semibold'
                        : 'border border-line text-stem hover:text-blueberry'
                    }`}
                  >
                    {item.targetPdbId} · {item.ligandName.split('(')[0].trim()}
                  </button>
                ))}
              </div>

              {activeComplex && (
                <>
                  <MoleculeViewer3D
                    pdbPath={pdbUrl}
                    title={activeComplex.title}
                    focusedResidue={focusedResidue}
                  />
                  <div className="space-y-2 text-xs">
                    <p className="text-blueberry leading-relaxed">
                      {activeComplex.clinicalExplanation}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-stem">
                      <span>Focus residue:</span>
                      {activeComplex.keyResidues.map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setFocusedResidue(res)}
                          className={`rounded border px-1.5 py-0.5 transition ${
                            focusedResidue === res
                              ? 'border-berry bg-surface-hover text-blueberry font-semibold'
                              : 'border-line text-blueberry hover:border-berry'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                    {activeComplex.countermeasureLink && (
                      <p className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-berry">
                        Countermeasure: {activeComplex.countermeasureLink}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: ODE Kinetics & Urine Sampling Window */}
            <div className="surface-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blueberry">
                  <FlaskConical className="h-4 w-4 text-status-caution" aria-hidden="true" />
                  Biomarker Kinetics &amp; Sampling Window
                </h3>
                <div className="flex gap-1.5">
                  {SHIELDING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShielding(opt.id)}
                      className={`tactile-press rounded-md px-2 py-1 font-mono text-[11px] transition ${
                        shielding === opt.id
                          ? 'border border-status-caution bg-[var(--status-caution-bg)] text-status-caution font-semibold'
                          : 'border border-line text-stem hover:text-blueberry'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <KineticsChart shieldingResults={data.shieldingResults} selectedShielding={shielding} />

              {activeShielding && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-md border border-line p-3">
                    <span className="text-stem block">Peak Dose Rate</span>
                    <span className="mt-1 block font-mono font-bold text-blueberry tabular-nums">
                      {activeShielding.peakDoseRateMicroSvPerHour.toFixed(1)} µSv/h
                    </span>
                  </div>
                  <div className="rounded-md border border-line p-3">
                    <span className="text-stem block">Peak γ-H2AX</span>
                    <span
                      className={`mt-1 block font-mono font-bold tabular-nums ${
                        activeShielding.isRepairSaturated
                          ? 'text-status-critical'
                          : 'text-status-nominal'
                      }`}
                    >
                      {activeShielding.peakGammaH2axFoci.toFixed(2)} foci/cell
                      {activeShielding.isRepairSaturated ? ' (SATURATED)' : ''}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-md border border-line p-3">
                    <span className="text-stem block">Urine 8-OHdG Window</span>
                    <span className="mt-1 block font-mono font-bold text-status-caution tabular-nums">
                      {activeShielding.urineSamplingWindow.startHour.toFixed(1)}–
                      {activeShielding.urineSamplingWindow.endHour.toFixed(1)} h
                    </span>
                  </div>
                </div>
              )}

              {activeShielding && (
                <p className="rounded-md border border-[var(--status-caution-border)] bg-[var(--status-caution-bg)] px-3 py-2 text-xs text-blueberry leading-relaxed">
                  {activeShielding.urineSamplingWindow.guidance}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
