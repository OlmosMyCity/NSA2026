/**
 * Biophysics digital-twin data service loading pre-computed A100 nonlinear ODE
 * DNA damage/repair kinetics (`gamma-H2AX`, `8-OHdG`) and AutoDock Vina molecular
 * docking evidence across solar radiation scenarios and shielding configurations.
 *
 * @module services/biophysicsService
 */

export type ScenarioId = 'NOMINAL' | 'FLARE_EARLY_WARNING' | 'PEAK_STORM_S4';
export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

export interface KineticsPoint {
  timeHours: number;
  doseRateMicroSvPerHour: number;
  gammaH2axFociPerCell: number;
  repairSaturationRatio: number;
  tissueDamage: number;
  blood8Ohdg: number;
  urine8OhdgNgMg: number;
}

export interface UrineSamplingWindow {
  startHour: number;
  peakHour: number;
  endHour: number;
  peakUrine8OhdgNgMg: number;
  guidance: string;
}

export interface ShieldingKineticsResult {
  shieldingType: ShieldingType;
  attenuationFactor: number;
  peakDoseRateMicroSvPerHour: number;
  peakGammaH2axFoci: number;
  timeToPeakGammaH2axHours: number;
  isRepairSaturated: boolean;
  maxRepairSaturationRatio: number;
  urineSamplingWindow: UrineSamplingWindow;
  curve: KineticsPoint[];
}

export interface DockingComplexEntry {
  id: string;
  title: string;
  category: string;
  targetProtein: string;
  targetPdbId: string;
  ligandName: string;
  bindingAffinityKcalMol: number;
  relativeEfficiencyPct?: number | null;
  keyResidues: string[];
  clinicalExplanation: string;
  countermeasureLink?: string | null;
  structureFile: string;
  source: string;
}

export interface BiophysicsScenarioResponse {
  scenario: ScenarioId;
  description: string;
  doseReductionShelterVsEvaPct: number;
  gammaH2axReductionShelterVsEvaPct: number;
  shieldingResults: Record<ShieldingType, ShieldingKineticsResult>;
  dockingEvidence: DockingComplexEntry[];
  astronautTakeaway: string;
  dataSource?: 'fastapi-biophysics' | 'static-a100-catalog';
}

function buildTakeaway(
  scenario: ScenarioId,
  entry: Omit<BiophysicsScenarioResponse, 'scenario' | 'dockingEvidence' | 'astronautTakeaway'>
): string {
  const evaWin = entry.shieldingResults.EVA_SUIT.urineSamplingWindow;
  if (scenario === 'NOMINAL') {
    return 'Nominal GCR background: basal NHEJ repair (Ku70/Ku80) handles ~0.6 γ-H2AX foci/cell with zero repair saturation. Routine 24h urine 8-OHdG monitoring is sufficient.';
  }
  if (scenario === 'FLARE_EARLY_WARNING') {
    return `X4.5 Flare Early Warning: moving to STORM_SHELTER before proton arrival cuts peak γ-H2AX by ${entry.gammaH2axReductionShelterVsEvaPct.toFixed(
      1
    )}%. Begin oral radioprotectors (NAC / Vit C / Vit E) now; optimal urine 8-OHdG check window is ${evaWin.startHour.toFixed(
      1
    )}–${evaWin.endHour.toFixed(1)}h.`;
  }
  return `PEAK_STORM_S4: EVA_SUIT saturates NHEJ DNA repair. STORM_SHELTER reduces dose rate by ${entry.doseReductionShelterVsEvaPct.toFixed(
    1
  )}% and prevents repair saturation. Collect urine 8-OHdG between ${evaWin.startHour.toFixed(
    1
  )}h and ${evaWin.endHour.toFixed(1)}h.`;
}

class BiophysicsService {
  async getScenario(scenario: ScenarioId): Promise<BiophysicsScenarioResponse> {
    const [scenariosRes, dockingRes] = await Promise.all([
      fetch('/biophysics/data/kinetics_scenarios.json'),
      fetch('/biophysics/data/docking_catalog.json'),
    ]);

    if (!scenariosRes.ok || !dockingRes.ok) {
      throw new Error('Unable to load biophysics catalog.');
    }

    const scenariosJson = (await scenariosRes.json()) as Record<
      ScenarioId,
      Omit<BiophysicsScenarioResponse, 'scenario' | 'dockingEvidence' | 'astronautTakeaway'>
    >;
    const dockingEvidence = (await dockingRes.json()) as DockingComplexEntry[];
    const entry = scenariosJson[scenario];

    return {
      scenario,
      ...entry,
      dockingEvidence,
      astronautTakeaway: buildTakeaway(scenario, entry),
      dataSource: 'static-a100-catalog',
    };
  }
}

export const biophysicsService = new BiophysicsService();
