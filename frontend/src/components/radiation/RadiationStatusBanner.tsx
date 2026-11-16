'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Send,
  CheckCircle2,
  WifiOff,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getRoleBasedSolarMeasures,
  getSolarAlertBand,
  getUniversalSolarProtocol,
  type OperationalRole,
  type SolarProtocolBlockId,
} from '@/domain/health/solarWind';
import type { RoutineCategory } from '@/domain/routine/types';
import { adminTriageService } from '@/services/adminTriageService';
import { astronautService } from '@/services/astronautService';
import { routineService } from '@/services/routineService';
import {
  NOAAStormScale,
  RadiationIncident,
  RadiationStatusResponse,
  radiationService,
} from '../../services/radiationService';

const S2_OR_HIGHER = new Set<NOAAStormScale>([
  'S2_MODERATE',
  'S3_STRONG',
  'S4_SEVERE',
  'S5_EXTREME',
]);

const SCALE_STYLES: Record<
  NOAAStormScale,
  { badge: string; border: string; bg: string; accentBar: string; label: string; crewGuidance: string }
> = {
  S0_NOMINAL: {
    badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
    border: 'border-emerald-500/30',
    bg: 'bg-slate-950/75',
    accentBar: 'border-l-2 border-l-emerald-400',
    label: 'S0 · Safe (Normal)',
    crewGuidance: 'Solar weather is calm — safe for normal operations and EVA.',
  },
  S1_MINOR: {
    badge: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
    border: 'border-amber-500/35',
    bg: 'bg-slate-950/80',
    accentBar: 'border-l-2 border-l-amber-400',
    label: 'S1 · Mild Activity',
    crewGuidance: 'Mild solar activity — normal cabin operations; monitor EVA updates.',
  },
  S2_MODERATE: {
    badge: 'border-amber-400/55 bg-amber-500/20 text-amber-200',
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/35',
    accentBar: 'border-l-2 border-l-amber-400',
    label: 'S2 · Moderate Solar Storm',
    crewGuidance: 'Moderate storm — pause EVA and stay inside the crew cabin.',
  },
  S3_STRONG: {
    badge: 'border-orange-400/55 bg-orange-500/20 text-orange-200',
    border: 'border-orange-500/50',
    bg: 'bg-orange-950/40',
    accentBar: 'border-l-2 border-l-orange-400',
    label: 'S3 · Strong Solar Storm',
    crewGuidance: 'Strong storm — abort EVA and prepare to move to Storm Shelter.',
  },
  S4_SEVERE: {
    badge: 'border-rose-400/60 bg-rose-500/20 text-rose-200',
    border: 'border-rose-500/60',
    bg: 'bg-rose-950/45',
    accentBar: 'border-l-2 border-l-rose-400',
    label: 'S4 · Severe Solar Storm',
    crewGuidance: 'High radiation — move to Storm Shelter immediately.',
  },
  S5_EXTREME: {
    badge: 'border-rose-400/75 bg-rose-600/30 text-rose-100',
    border: 'border-rose-500/75',
    bg: 'bg-rose-950/60',
    accentBar: 'border-l-2 border-l-rose-500',
    label: 'S5 · Extreme Solar Storm',
    crewGuidance: 'Extreme radiation — remain in Storm Shelter until all-clear.',
  },
};

const ROLE_SHORT: Record<OperationalRole, string> = {
  OPERATOR: 'Ground Operator',
  ADMIN: 'Flight Surgeon',
  USER: 'Astronaut',
};

const BLOCK_TO_ROUTINE_CATEGORY: Record<SolarProtocolBlockId, RoutineCategory> = {
  PHYSICAL_OPS: 'BIOMEDICAL',
  BIOMEDICAL_DOSIMETRY: 'BIOMEDICAL',
  CLINICAL_WELLBEING: 'NUTRITION',
  COMMS_COMMAND: 'PSYCHOLOGICAL',
};

/**
 * Global solar radiation & early-warning banner polled every 60s.
 * Restricts persisted emergency checklist items to S2+ / early-warning conditions,
 * displays Autonomous Onboard Mode latency rules + live shielding dose rates,
 * and supports 1-click Flight Surgeon directives.
 */
export function RadiationStatusBanner() {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<RadiationStatusResponse | null>(null);
  const [incident, setIncident] = useState<RadiationIncident | null>(null);
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [sendingDirective, setSendingDirective] = useState(false);
  const [directiveFeedback, setDirectiveFeedback] = useState<string | null>(null);

  const loadRadiation = useCallback(async () => {
    try {
      const nextStatus = await radiationService.getStatus();
      setStatus(nextStatus);

      if (S2_OR_HIGHER.has(nextStatus.currentTelemetry.stormScale)) {
        setExpanded(true);
        const activeIncident = await radiationService.getActiveRadiationIncident().catch(() => null);
        setIncident(activeIncident);
      } else {
        setIncident(null);
      }
    } catch {
      // Handled by radiationService fallback
    }
  }, []);

  useEffect(() => {
    loadRadiation();
    const timer = setInterval(loadRadiation, 60_000);
    return () => clearInterval(timer);
  }, [loadRadiation]);

  const activeRole: OperationalRole = user?.role ?? 'USER';
  const routineSubjectId = user?.astronautId ?? user?.id ?? 'active-crew';
  const stormScale: NOAAStormScale = status?.currentTelemetry.stormScale ?? 'S0_NOMINAL';
  const earlyWarningActive = Boolean(status?.earlyWarning?.isWarningActive);
  const alertBand = getSolarAlertBand(stormScale, earlyWarningActive);
  const isElevatedOrStorm = alertBand !== 'S0_S1';
  const universalProtocol = useMemo(() => getUniversalSolarProtocol(alertBand), [alertBand]);
  const style = SCALE_STYLES[stormScale];

  const roleMeasures = useMemo(
    () => getRoleBasedSolarMeasures(stormScale, earlyWarningActive),
    [stormScale, earlyWarningActive],
  );
  const myGroup = roleMeasures[activeRole];

  // Restrict routine-synced emergency tasks to S2+ / active early-warning conditions (empty in S0_S1)
  const solarRoutineTasks = useMemo(() => {
    if (!isElevatedOrStorm) return [];

    const physicalBlock = universalProtocol.blocks[0];
    const biomedicalBlock = universalProtocol.blocks[1];
    const wellbeingBlock = universalProtocol.blocks[2];
    const hazardTarget = `Space Radiation (${universalProtocol.label})`;

    return [
      {
        id: `solar-${alertBand}-PHYSICAL_OPS`,
        blockId: 'PHYSICAL_OPS' as SolarProtocolBlockId,
        title: physicalBlock?.actions[0] ?? 'Abort/postpone EVA & move crew to shielded zone',
        description: `${physicalBlock?.title ?? '1. Physical Protection'} · Synchronized with Solar Weather Forecast`,
        category: BLOCK_TO_ROUTINE_CATEGORY.PHYSICAL_OPS,
        estimatedMinutes: 10,
        hrpHazardTarget: hazardTarget,
      },
      {
        id: `solar-${alertBand}-BIOMEDICAL_DOSIMETRY`,
        blockId: 'BIOMEDICAL_DOSIMETRY' as SolarProtocolBlockId,
        title: biomedicalBlock?.actions[0] ?? 'Step up vital & active dosimeter logging to every 4–6 h',
        description: `${biomedicalBlock?.title ?? '2. Biomedical Monitoring'} · Synchronized with Solar Weather Forecast`,
        category: BLOCK_TO_ROUTINE_CATEGORY.BIOMEDICAL_DOSIMETRY,
        estimatedMinutes: 10,
        hrpHazardTarget: hazardTarget,
      },
      {
        id: `solar-${alertBand}-CLINICAL_WELLBEING`,
        blockId: 'CLINICAL_WELLBEING' as SolarProtocolBlockId,
        title: wellbeingBlock?.actions[0] ?? 'Execute storm hydration (>=2.5 L) & radioprotective protocol',
        description: `${wellbeingBlock?.title ?? '3. Clinical Countermeasures'} · Synchronized with Solar Weather Forecast`,
        category: BLOCK_TO_ROUTINE_CATEGORY.CLINICAL_WELLBEING,
        estimatedMinutes: 10,
        hrpHazardTarget: hazardTarget,
      },
    ];
  }, [isElevatedOrStorm, universalProtocol, alertBand]);

  // Sync solar protocol tasks with `/routine` (`routineService`) and purge stale `solar-*` tasks in S0_S1
  useEffect(() => {
    if (!status || !isAuthenticated) return;
    const state = routineService.syncSolarProtocolTasks(
      routineSubjectId,
      alertBand,
      solarRoutineTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        estimatedMinutes: t.estimatedMinutes,
        hrpHazardTarget: t.hrpHazardTarget,
      })),
    );
    const nextMap: Record<string, boolean> = {};
    state.tasks.forEach((t) => {
      if (t.id.startsWith('solar-')) {
        nextMap[t.id] = t.completed;
      }
    });
    setCompletedMap(nextMap);
  }, [status, isAuthenticated, routineSubjectId, alertBand, solarRoutineTasks]);

  useEffect(() => {
    const refreshFromRoutine = () => {
      const state = routineService.getRoutineState(routineSubjectId);
      const nextMap: Record<string, boolean> = {};
      state.tasks.forEach((t) => {
        if (t.id.startsWith('solar-')) {
          nextMap[t.id] = t.completed;
        }
      });
      setCompletedMap(nextMap);
    };
    window.addEventListener('orbvital:routine-updated', refreshFromRoutine);
    return () => window.removeEventListener('orbvital:routine-updated', refreshFromRoutine);
  }, [routineSubjectId]);

  const checkedCount = useMemo(
    () => solarRoutineTasks.filter((t) => completedMap[t.id]).length,
    [solarRoutineTasks, completedMap],
  );
  const allConfirmed = solarRoutineTasks.length > 0 && checkedCount === solarRoutineTasks.length;

  const toggleItem = (taskId: string) => {
    const updated = routineService.toggleTask(routineSubjectId, taskId);
    const nextMap: Record<string, boolean> = {};
    updated.tasks.forEach((t) => {
      if (t.id.startsWith('solar-')) {
        nextMap[t.id] = t.completed;
      }
    });
    setCompletedMap(nextMap);
  };

  const handleAcknowledge = async () => {
    if (!incident || incident.status !== 'OPEN' || !allConfirmed) return;
    setAcknowledging(true);
    setAckError(null);
    try {
      const updated = await radiationService.acknowledgeIncident(incident.id);
      setIncident(updated);
    } catch (err) {
      setAckError(err instanceof Error ? err.message : 'Unable to acknowledge radiation incident.');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleBroadcastDirective = async () => {
    if (activeRole !== 'ADMIN' || sendingDirective) return;
    setSendingDirective(true);
    setDirectiveFeedback(null);
    try {
      const crewRes = await astronautService.list({ limit: 50 });
      const tpl = universalProtocol.directiveTemplate;
      const directiveText = `${tpl.title}\n${tpl.body}\n[Window: T+00:00 -> T+${String(tpl.defaultWindowHours).padStart(2, '0')}:00 UTC | All-Clear: ${tpl.allClearCriteria}]`;
      await Promise.all(
        crewRes.data.map((a) => adminTriageService.sendClinicalDirectives(a.id, directiveText)),
      );
      setDirectiveFeedback(`1-click ${tpl.shortLabel} directive transmitted to ${crewRes.data.length} crew members.`);
    } catch {
      setDirectiveFeedback(
        'Backend offline: protocol activated locally for Flight Surgeon console review.',
      );
    } finally {
      setSendingDirective(false);
    }
  };

  if (!status) return null;

  const proton10 = status.currentTelemetry.latestProtons?.find((p) =>
    p.energyChannel.includes('10'),
  );

  const shieldingComparison = [
    {
      label: 'EVA Suit',
      dose: status.biologicalDoses?.EVA_SUIT?.doseRateMicroSvPerHour ?? 28.0,
      riskLabel: status.biologicalDoses?.EVA_SUIT?.clinicalRiskLevel ?? 'ELEVATED',
      riskClass: 'text-amber-300',
    },
    {
      label: 'Crew Cabin',
      dose: status.biologicalDoses?.CREW_CABIN_NOMINAL?.doseRateMicroSvPerHour ?? 18.0,
      riskLabel: status.biologicalDoses?.CREW_CABIN_NOMINAL?.clinicalRiskLevel ?? 'NOMINAL',
      riskClass: 'text-sky-300',
    },
    {
      label: 'Storm Shelter',
      dose: status.biologicalDoses?.STORM_SHELTER?.doseRateMicroSvPerHour ?? 4.0,
      riskLabel: status.biologicalDoses?.STORM_SHELTER?.clinicalRiskLevel ?? 'SHIELDED',
      riskClass: 'text-emerald-300',
    },
  ];

  const scaleDotClass =
    stormScale === 'S0_NOMINAL'
      ? 'bg-emerald-400'
      : stormScale === 'S1_MINOR' || stormScale === 'S2_MODERATE'
        ? 'bg-amber-400'
        : 'bg-rose-400 animate-pulse';

  return (
    <div className={`w-full rounded-md border ${style.border} bg-surface/85 backdrop-blur-md`}>
      <div className="max-w-container mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wide text-blueberry tabular-nums">
              <span className={`h-2 w-2 rounded-full shrink-0 ${scaleDotClass}`} aria-hidden="true" />
              <span>{style.label}</span>
            </span>

            <span className="hidden sm:inline-block h-3.5 w-px bg-line/80" aria-hidden="true" />

            <span className="text-blueberry/90 truncate max-w-xl">
              {style.crewGuidance}
            </span>

            {(status.currentTelemetry.latestXray?.currentClass || proton10) && (
              <span
                className="font-mono text-[11px] text-stem tabular-nums"
                title="NOAA/GOES solar telemetry"
              >
                {status.currentTelemetry.latestXray?.currentClass ? `X-Ray ${status.currentTelemetry.latestXray.currentClass}` : ''}
                {status.currentTelemetry.latestXray?.currentClass && proton10 ? ' · ' : ''}
                {proton10 ? `${proton10.fluxPfu.toFixed(1)} pfu` : ''}
              </span>
            )}

            {earlyWarningActive && status.earlyWarning?.triggerEvent && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Storm Warning
                  {status.earlyWarning.estimatedProtonArrivalMinutes != null &&
                    ` (~${status.earlyWarning.estimatedProtonArrivalMinutes} min)`}
                </span>
              </span>
            )}

            {status.telemetryDegraded && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300">
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Local SWPC</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {incident && (
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tabular-nums ${
                  incident.status === 'ACKNOWLEDGED' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                <span>Incident {incident.status}</span>
              </span>
            )}
            {isAuthenticated && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((prev) => !prev)}
                className="tactile-press inline-flex items-center gap-1.5 rounded border border-line/80 bg-surface-subtle/70 px-2.5 py-1 text-[11px] font-medium text-blueberry hover:border-berry hover:bg-surface-hover"
              >
                <span>{activeRole === 'USER' ? 'Measures' : `Measures · ${ROLE_SHORT[activeRole]}`}</span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-stem" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-stem" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>

        {expanded && isAuthenticated && (
          <div className="mt-3 pt-4 border-t border-line space-y-4 text-xs animate-materialize">
            {/* Row 1: Autonomous Onboard Protocol & Shielding Attenuation Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7 rounded-sm border border-amber-400/35 border-l-2 border-l-amber-400 bg-amber-950/45 p-3.5 flex flex-col justify-between gap-2">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-200">
                    Autonomous Onboard Mode · Comms Latency / Blackout Protocol
                  </span>
                </div>
                <p className="text-xs font-medium text-blueberry leading-relaxed">
                  {universalProtocol.autonomousRule}
                </p>
                <p className="font-mono text-[11px] text-amber-200/90">
                  Pre-approved matrix: S0–S1 Watch · S2–S3 Hold EVA &amp; Stage Shelter · S4–S5 Mandatory STORM_SHELTER
                </p>
              </div>

              <div className="lg:col-span-5 grid grid-cols-3 gap-2">
                {shieldingComparison.map((cell) => (
                  <div
                    key={cell.label}
                    className="rounded-sm border border-line bg-surface-subtle/70 p-3 flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-mono text-stem uppercase">{cell.label}</span>
                    <span className="mt-1 font-mono text-sm font-bold text-blueberry tabular-nums">
                      {cell.dose.toFixed(1)} µSv/h
                    </span>
                    <span className={`mt-0.5 font-mono text-[10px] ${cell.riskClass}`}>
                      {cell.riskLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: Operational Protocol & Role Coordination */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 rounded-sm border border-line bg-surface/90 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-blueberry">{myGroup.roleTitle}</h4>
                    <p className="text-xs text-stem">{myGroup.subtitle}</p>
                  </div>
                  {isElevatedOrStorm ? (
                    <span className="rounded-sm border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-200 tabular-nums">
                      Emergency Checklist Confirmed: {checkedCount}/3 (Synced with /routine)
                    </span>
                  ) : (
                    <Link
                      href="/routine"
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-stem hover:text-blueberry"
                    >
                      <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Daily Protocol Baseline</span>
                    </Link>
                  )}
                </div>

                {!isElevatedOrStorm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {universalProtocol.blocks.map((block) => (
                      <div
                        key={block.id}
                        className="border-l-2 border-berry/70 bg-surface-subtle/40 pl-3 py-1.5"
                      >
                        <p className="text-xs font-semibold text-blueberry">{block.title}</p>
                        <p className="mt-0.5 text-xs text-stem leading-relaxed">
                          {block.actions[0]}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {solarRoutineTasks.map((task) => (
                      <label
                        key={task.id}
                        htmlFor={task.id}
                        className="flex items-start gap-2.5 rounded-sm border border-line bg-surface-subtle/50 p-2.5 cursor-pointer hover:border-berry transition-colors"
                      >
                        <input
                          id={task.id}
                          type="checkbox"
                          checked={Boolean(completedMap[task.id])}
                          onChange={() => toggleItem(task.id)}
                          className="mt-0.5 h-4 w-4 accent-emerald-400 rounded-sm"
                        />
                        <span className="text-xs font-medium text-blueberry leading-snug">
                          {task.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {activeRole === 'ADMIN' && (
                      <>
                        <button
                          type="button"
                          disabled={sendingDirective}
                          onClick={handleBroadcastDirective}
                          className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-plate px-3 py-1.5 font-semibold text-ink-inverse hover:bg-white disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {sendingDirective
                              ? 'Transmitting directive...'
                              : `1-Click Send ${universalProtocol.directiveTemplate.shortLabel} Directive`}
                          </span>
                        </button>
                        <Link
                          href="/admin"
                          className="font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                        >
                          Open Flight Surgeon Console
                        </Link>
                      </>
                    )}

                    {activeRole === 'OPERATOR' && (
                      <>
                        {incident && incident.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={!allConfirmed || acknowledging}
                            onClick={handleAcknowledge}
                            className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-plate px-3 py-1.5 font-semibold text-ink-inverse hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {acknowledging ? 'Acknowledging...' : 'Acknowledge Incident'}
                          </button>
                        )}
                        <Link
                          href="/operator"
                          className="font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                        >
                          Open Operator Console
                        </Link>
                      </>
                    )}

                    {activeRole === 'USER' && (
                      <>
                        <Link
                          href="/readings/new"
                          className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-plate px-3 py-1.5 font-semibold text-ink-inverse hover:bg-white"
                        >
                          Log Biometric Reading
                        </Link>
                        <Link
                          href="/routine"
                          className="font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                        >
                          Open Crew Routine
                        </Link>
                      </>
                    )}
                  </div>

                  {directiveFeedback && (
                    <p className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{directiveFeedback}</span>
                    </p>
                  )}
                  {ackError && <p className="text-rose-300 font-medium">{ackError}</p>}
                </div>
              </div>

              <div className="lg:col-span-4 rounded-sm border border-line bg-surface/80 p-4 space-y-3">
                <h4 className="font-semibold text-blueberry">Cross-Role Coordination</h4>
                {(['OPERATOR', 'ADMIN', 'USER'] as OperationalRole[])
                  .filter((r) => r !== activeRole)
                  .map((r) => (
                    <div
                      key={r}
                      className="space-y-1 border-t border-line/60 pt-2.5 first:border-t-0 first:pt-0"
                    >
                      <p className="text-xs font-semibold text-blueberry">
                        {roleMeasures[r].roleTitle}
                      </p>
                      <p className="text-xs text-stem leading-relaxed">
                        {roleMeasures[r].actions[0]}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
