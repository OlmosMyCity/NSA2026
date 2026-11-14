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

export function MolecularTwinSection() {
  const [scenario, setScenario] = useState<ScenarioId>('PEAK_STORM_S4');
  const [shielding, setShielding] = useState<ShieldingType>('EVA_SUIT');
  const [data, setData] = useState<BiophysicsScenarioResponse | null>(null);
  const [selectedComplexId, setSelectedComplexId] = useState<string>('keap1_tocopherol');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    biophysicsService
      .getScenario(scenario)
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Unable to load biophysics data.');
      });
    return () => {
      alive = false;
    };
  }, [scenario]);

  const activeComplex =
    data?.dockingEvidence.find((c) => c.id === selectedComplexId) ?? data?.dockingEvidence[0];

  // Fallback to 1JEY.pdb if a specific clustered lesion PDB wasn't generated
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
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-sky-400">
            <Dna className="h-4 w-4" aria-hidden="true" />
            <span>Plan B · A100 Pre-Computed Molecular Twin</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-blueberry">
            DNA Repair Kinetics & Radioprotector Docking
          </h2>
          <p className="mt-1 text-sm text-stem max-w-2xl">
            Real AutoDock Vina poses (A100 GPU) and nonlinear Michaelis–Menten γ-H2AX / 8-OHdG ODE
            simulations linked to space weather shielding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SCENARIO_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScenario(opt.id)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                scenario === opt.id
                  ? 'border border-sky-400/60 bg-sky-500/15 text-sky-300'
                  : 'border border-line text-stem hover:text-blueberry'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="surface-card border-rose-500/40 p-4 text-sm text-rose-300">{error}</div>
      )}

      {data && (
        <>
          {/* Takeaway Banner */}
          <div className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {activeShielding?.isRepairSaturated ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium text-blueberry">{data.astronautTakeaway}</p>
                <p className="mt-0.5 text-xs text-stem">{data.description}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 font-mono text-xs">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                Dose -{data.doseReductionShelterVsEvaPct.toFixed(1)}% (Shelter)
              </span>
              <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-300">
                γ-H2AX -{data.gammaH2axReductionShelterVsEvaPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: 3D Molecular Docking Viewer */}
            <div className="surface-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blueberry">
                  <Atom className="h-4 w-4 text-sky-400" aria-hidden="true" />
                  3D Molecular Complex (A100 Docking)
                </h3>
                {activeComplex && (
                  <span className="font-mono text-xs rounded bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-emerald-300">
                    ΔG = {activeComplex.bindingAffinityKcalMol.toFixed(3)} kcal/mol
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {data.dockingEvidence.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedComplexId(item.id)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition ${
                      activeComplex?.id === item.id
                        ? 'border border-sky-400/60 bg-sky-500/15 text-sky-300'
                        : 'border border-line text-stem hover:text-blueberry'
                    }`}
                  >
                    {item.targetPdbId} · {item.ligandName.split('(')[0].trim()}
                  </button>
                ))}
              </div>

              {activeComplex && (
                <>
                  <MoleculeViewer3D pdbPath={pdbUrl} title={activeComplex.title} />
                  <div className="space-y-2 text-xs">
                    <p className="text-blueberry leading-relaxed">
                      {activeComplex.clinicalExplanation}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-stem">
                      <span>Key residues:</span>
                      {activeComplex.keyResidues.map((res) => (
                        <span
                          key={res}
                          className="rounded border border-line px-1.5 py-0.5 text-blueberry"
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                    {activeComplex.countermeasureLink && (
                      <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sky-200">
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
                  <FlaskConical className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  ODE Biomarker Kinetics & Sampling Window
                </h3>
                <div className="flex gap-1.5">
                  {SHIELDING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShielding(opt.id)}
                      className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${
                        shielding === opt.id
                          ? 'border border-amber-400/60 bg-amber-500/15 text-amber-300'
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
                  <div className="rounded-lg border border-line p-3">
                    <span className="text-stem block">Peak Dose Rate</span>
                    <span className="mt-1 block font-mono font-bold text-blueberry">
                      {activeShielding.peakDoseRateMicroSvPerHour.toFixed(1)} µSv/h
                    </span>
                  </div>
                  <div className="rounded-lg border border-line p-3">
                    <span className="text-stem block">Peak γ-H2AX</span>
                    <span
                      className={`mt-1 block font-mono font-bold ${
                        activeShielding.isRepairSaturated ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {activeShielding.peakGammaH2axFoci.toFixed(2)} foci/cell
                      {activeShielding.isRepairSaturated ? ' (SATURATED)' : ''}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-lg border border-line p-3">
                    <span className="text-stem block">Urine 8-OHdG Window</span>
                    <span className="mt-1 block font-mono font-bold text-amber-300">
                      {activeShielding.urineSamplingWindow.startHour.toFixed(1)}–
                      {activeShielding.urineSamplingWindow.endHour.toFixed(1)} h
                    </span>
                  </div>
                </div>
              )}

              {activeShielding && (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 leading-relaxed">
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
