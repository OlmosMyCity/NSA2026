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
  type SolarProtocolBlock,
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

const SCALE_STYLES: Record<NOAAStormScale, { badge: string; border: string; bg: string; label: string }> = {
  S0_NOMINAL: {
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/5',
    label: 'S0 Nominal',
  },
  S1_MINOR: {
    badge: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    label: 'S1 Minor',
  },
  S2_MODERATE: {
    badge: 'bg-amber-500/20 text-amber-900 border-amber-600/40',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    label: 'S2 Moderate',
  },
  S3_STRONG: {
    badge: 'bg-orange-500/20 text-orange-900 border-orange-600/40',
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/10',
    label: 'S3 Strong',
  },
  S4_SEVERE: {
    badge: 'bg-rose-500/20 text-rose-900 border-rose-600/40',
    border: 'border-rose-500/60',
    bg: 'bg-rose-500/10',
    label: 'S4 Severe',
  },
  S5_EXTREME: {
    badge: 'bg-rose-600/25 text-rose-950 border-rose-700/50',
    border: 'border-rose-600/70',
    bg: 'bg-rose-600/15',
    label: 'S5 Extreme',
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
 * Organizes mitigation into the 4 standard space-medicine blocks across 3 severity bands
 * (S0-S1 / S2-S3 / S4-S5), persists checklist state into `/routine`, displays Autonomous
 * Onboard Mode rules for comms latency/blackout, and supports 1-click Flight Surgeon directives.
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
  const universalProtocol = useMemo(() => getUniversalSolarProtocol(alertBand), [alertBand]);
  const showStormChecklist = S2_OR_HIGHER.has(stormScale);
  const style = SCALE_STYLES[stormScale];

  const roleMeasures = useMemo(
    () => getRoleBasedSolarMeasures(stormScale, earlyWarningActive),
    [stormScale, earlyWarningActive],
  );
  const myGroup = roleMeasures[activeRole];

  // Build deterministic routine-synced tasks for the 4 standard space-medicine blocks
  const solarRoutineTasks = useMemo(() => {
    const tasks: {
      id: string;
      blockId: SolarProtocolBlockId;
      title: string;
      description: string;
      category: RoutineCategory;
      estimatedMinutes: number;
      hrpHazardTarget: string;
    }[] = [];

    universalProtocol.blocks.forEach((block: SolarProtocolBlock) => {
      block.actions.forEach((action: string, idx: number) => {
        tasks.push({
          id: `solar-${alertBand}-${block.id}-${idx}`,
          blockId: block.id,
          title: `[${alertBand.replace('_', '–')}] ${action}`,
          description: `${block.title} · Synchronized with Solar Weather Forecast`,
          category: BLOCK_TO_ROUTINE_CATEGORY[block.id],
          estimatedMinutes: 10,
          hrpHazardTarget: `Space Radiation (${universalProtocol.label})`,
        });
      });
    });

    return tasks;
  }, [universalProtocol, alertBand]);

  // Sync solar protocol tasks with `/routine` (`routineService`) so both views share one persisted state
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

  return (
    <div className={`w-full border-b ${style.border} ${style.bg}`}>
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold border ${style.badge}`}
            >
              Solar Radiation: {style.label}
            </span>
            <span className="font-mono text-[11px] font-semibold text-blueberry/80">
              [{universalProtocol.label}]
            </span>
            {status.currentTelemetry.latestXray?.currentClass && (
              <span className="text-blueberry/80 font-mono">
                X-Ray: {status.currentTelemetry.latestXray.currentClass}
              </span>
            )}
            {proton10 && (
              <span className="text-blueberry/80 font-mono">
                Protons &gt;10 MeV: {proton10.fluxPfu.toFixed(1)} pfu
              </span>
            )}
            {earlyWarningActive && status.earlyWarning?.triggerEvent && (
              <span className="inline-flex items-center gap-1 text-amber-900 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                Early Warning: {status.earlyWarning.triggerEvent}
                {status.earlyWarning.estimatedProtonArrivalMinutes != null &&
                  ` (~${status.earlyWarning.estimatedProtonArrivalMinutes} min)`}
              </span>
            )}
            {status.telemetryDegraded && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                <WifiOff className="h-3 w-3" aria-hidden="true" />
                Autonomous Onboard Mode (Local SWPC)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {incident && (
              <span
                className={`px-2 py-0.5 rounded-full font-semibold border ${
                  incident.status === 'ACKNOWLEDGED'
                    ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-800 border-rose-500/30'
                }`}
              >
                Incident: {incident.status}
              </span>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-blueberry hover:bg-surface-tinted"
              >
                <span>Measures · {ROLE_SHORT[activeRole]}</span>
                {expanded ? (
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>

        {expanded && isAuthenticated && (
          <div className="mt-3 pt-3 border-t border-black/10 space-y-4 text-xs">
            {/* Autonomous Onboard Mode banner (latency / blackout fallback matrix) */}
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <WifiOff className="h-4 w-4 text-amber-800 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold text-amber-950">
                    Autonomous Onboard Mode (Comms Latency / Blackout Protocol)
                  </p>
                  <p className="text-[11px] text-amber-900">
                    {universalProtocol.autonomousRule} · Pre-approved matrix: S0–S1 Watch | S2–S3 Hold EVA &amp; Stage Shelter | S4–S5 Mandatory STORM_SHELTER.
                  </p>
                </div>
              </div>
              <Link
                href="/routine"
                className="inline-flex items-center gap-1 rounded-md border border-amber-700/30 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-white self-start sm:self-auto"
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Synced with /routine</span>
              </Link>
            </div>

            {/* 4 Standard Space-Medicine Blocks (Universal Checklist persisted to /routine) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {universalProtocol.blocks.map((block) => {
                const blockTasks = solarRoutineTasks.filter((t) => t.blockId === block.id);
                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-line bg-surface/90 p-3.5 space-y-2"
                  >
                    <h4 className="font-bold text-blueberry">{block.title}</h4>
                    <ul className="space-y-1.5">
                      {blockTasks.map((task, idx) => (
                        <li key={task.id} className="flex items-start gap-2">
                          <input
                            id={task.id}
                            type="checkbox"
                            checked={Boolean(completedMap[task.id])}
                            onChange={() => toggleItem(task.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400"
                          />
                          <label htmlFor={task.id} className="cursor-pointer leading-snug text-blueberry">
                            {block.actions[idx]}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Role-specific command bar & cross-role coordination */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-lg border border-line bg-surface/90 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-blueberry">{myGroup.roleTitle}</h4>
                    <p className="text-[11px] text-stem">{myGroup.subtitle}</p>
                  </div>
                  <span className="font-mono text-[11px] text-stem">
                    Confirmed: {checkedCount}/{solarRoutineTasks.length}
                  </span>
                </div>

                <ul className="list-disc pl-4 space-y-1 text-blueberry/90">
                  {myGroup.actions.map((item, idx) => (
                    <li key={idx} className="leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  {activeRole === 'ADMIN' && (
                    <>
                      <button
                        type="button"
                        disabled={sendingDirective}
                        onClick={handleBroadcastDirective}
                        className="tactile-press inline-flex items-center gap-1.5 rounded-md bg-blueberry px-3 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
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
                          className="px-3 py-1.5 rounded-md font-semibold bg-blueberry text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
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
                        className="tactile-press inline-flex items-center gap-1.5 rounded-md bg-blueberry px-3 py-1.5 font-semibold text-white hover:opacity-90"
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
                  <p className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{directiveFeedback}</span>
                  </p>
                )}
                {ackError && <p className="text-rose-700">{ackError}</p>}
              </div>

              <div className="rounded-lg border border-line bg-surface/70 p-3.5 space-y-2.5">
                <h4 className="font-semibold text-blueberry">Cross-Role Coordination</h4>
                {(['OPERATOR', 'ADMIN', 'USER'] as OperationalRole[])
                  .filter((r) => r !== activeRole)
                  .map((r) => (
                    <div
                      key={r}
                      className="space-y-1 border-t border-line/60 pt-2 first:border-t-0 first:pt-0"
                    >
                      <p className="font-semibold text-blueberry/90">{roleMeasures[r].roleTitle}</p>
                      <p className="text-[11px] text-stem leading-snug">
                        {roleMeasures[r].actions[0]}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* S2+ backend mitigation checklist summary */}
            {showStormChecklist && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-black/10">
                <div>
                  <h4 className="font-semibold text-blueberry mb-1.5">
                    Backend Flight Rules ({stormScale})
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-blueberry/90">
                    {status.mitigation.actionChecklist.map((item, idx) => (
                      <li key={idx} className="leading-snug">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-blueberry mb-1.5">
                    Medical Countermeasures
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-blueberry/90">
                    {status.mitigation.medicalCountermeasures.map((item, idx) => (
                      <li key={idx} className="leading-snug">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
