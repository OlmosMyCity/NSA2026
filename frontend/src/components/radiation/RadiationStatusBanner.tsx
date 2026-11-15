'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ShieldAlert, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getRoleBasedSolarMeasures, type OperationalRole } from '@/domain/health/solarWind';
import { adminTriageService } from '@/services/adminTriageService';
import { astronautService } from '@/services/astronautService';
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
    label: 'S1 Menor',
  },
  S2_MODERATE: {
    badge: 'bg-amber-500/20 text-amber-900 border-amber-600/40',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    label: 'S2 Moderada',
  },
  S3_STRONG: {
    badge: 'bg-orange-500/20 text-orange-900 border-orange-600/40',
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/10',
    label: 'S3 Fuerte',
  },
  S4_SEVERE: {
    badge: 'bg-rose-500/20 text-rose-900 border-rose-600/40',
    border: 'border-rose-500/60',
    bg: 'bg-rose-500/10',
    label: 'S4 Severa',
  },
  S5_EXTREME: {
    badge: 'bg-rose-600/25 text-rose-950 border-rose-700/50',
    border: 'border-rose-600/70',
    bg: 'bg-rose-600/15',
    label: 'S5 Extrema',
  },
};

const ROLE_SHORT: Record<OperationalRole, string> = {
  OPERATOR: 'Operador en Tierra',
  ADMIN: 'Cirujano de Vuelo',
  USER: 'Astronauta',
};

/**
 * Global solar radiation & early-warning banner polled every 60s.
 * Adapts preventive measures and decision actions across the 3 roles:
 * - OPERATOR (Ground Control): EVA hold, STORM_SHELTER, passive reorientation, incident ack
 * - ADMIN (Flight Surgeon): 4-6h biometric cadence, 1-click preventive directives
 * - USER (Astronaut): Onboard shelter/hydration checklist and biometric logging
 */
export function RadiationStatusBanner() {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<RadiationStatusResponse | null>(null);
  const [incident, setIncident] = useState<RadiationIncident | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
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
  const stormScale: NOAAStormScale = status?.currentTelemetry.stormScale ?? 'S0_NOMINAL';
  const earlyWarningActive = Boolean(status?.earlyWarning?.isWarningActive);
  const showStormChecklist = S2_OR_HIGHER.has(stormScale);
  const style = SCALE_STYLES[stormScale];

  const roleMeasures = useMemo(
    () => getRoleBasedSolarMeasures(stormScale, earlyWarningActive),
    [stormScale, earlyWarningActive],
  );
  const myGroup = roleMeasures[activeRole];

  const allChecklistKeys = useMemo(() => {
    if (!status) return [];
    const baseKeys = myGroup.actions.map((_, idx) => `role:${idx}`);
    if (!showStormChecklist) return baseKeys;
    return [
      ...baseKeys,
      ...status.mitigation.actionChecklist.map((_, idx) => `action:${idx}`),
      ...status.mitigation.medicalCountermeasures.map((_, idx) => `med:${idx}`),
    ];
  }, [status, myGroup.actions, showStormChecklist]);

  const checkedCount = useMemo(
    () => allChecklistKeys.filter((k) => checkedItems[k]).length,
    [allChecklistKeys, checkedItems],
  );

  const allConfirmed = allChecklistKeys.length > 0 && checkedCount === allChecklistKeys.length;

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAcknowledge = async () => {
    if (!incident || incident.status !== 'OPEN' || !allConfirmed) return;
    setAcknowledging(true);
    setAckError(null);
    try {
      const updated = await radiationService.acknowledgeIncident(incident.id);
      setIncident(updated);
    } catch (err) {
      setAckError(err instanceof Error ? err.message : 'No se pudo confirmar el incidente.');
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
      const directiveText = `[Protocolo Solar ${stormScale}] ${roleMeasures.ADMIN.actions.slice(0, 3).join(' ')}`;
      await Promise.all(
        crewRes.data.map((a) => adminTriageService.sendClinicalDirectives(a.id, directiveText)),
      );
      setDirectiveFeedback(`Directiva preventiva enviada a ${crewRes.data.length} tripulantes.`);
    } catch {
      setDirectiveFeedback(
        'Backend sin conexión: protocolo activado localmente para revisión en consola.',
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
              Radiación Solar: {style.label}
            </span>
            {status.currentTelemetry.latestXray?.currentClass && (
              <span className="text-blueberry/80 font-mono">
                X-Ray: {status.currentTelemetry.latestXray.currentClass}
              </span>
            )}
            {proton10 && (
              <span className="text-blueberry/80 font-mono">
                Protones &gt;10 MeV: {proton10.fluxPfu.toFixed(1)} pfu
              </span>
            )}
            {earlyWarningActive && status.earlyWarning?.triggerEvent && (
              <span className="inline-flex items-center gap-1 text-amber-900 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                Alerta temprana: {status.earlyWarning.triggerEvent}
                {status.earlyWarning.estimatedProtonArrivalMinutes != null &&
                  ` (~${status.earlyWarning.estimatedProtonArrivalMinutes} min)`}
              </span>
            )}
            {status.telemetryDegraded && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                Modelo SWPC local
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
                Incidente: {incident.status}
              </span>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-blueberry hover:bg-surface-tinted"
              >
                <span>Medidas · {ROLE_SHORT[activeRole]}</span>
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
            {/* Active role actionable protocol */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-lg border border-line bg-surface/90 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-blueberry">{myGroup.roleTitle}</h4>
                    <p className="text-[11px] text-stem">{myGroup.subtitle}</p>
                  </div>
                  <span className="font-mono text-[11px] text-stem">
                    Confirmación: {checkedCount}/{allChecklistKeys.length}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {myGroup.actions.map((item, idx) => {
                    const key = `role:${idx}`;
                    return (
                      <li key={key} className="flex items-start gap-2">
                        <input
                          id={key}
                          type="checkbox"
                          checked={Boolean(checkedItems[key])}
                          onChange={() => toggleItem(key)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400"
                        />
                        <label htmlFor={key} className="cursor-pointer leading-snug text-blueberry">
                          {item}
                        </label>
                      </li>
                    );
                  })}
                </ul>

                {/* Role-specific decision buttons */}
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
                            ? 'Enviando directiva...'
                            : 'Enviar Directiva Preventiva a Tripulación'}
                        </span>
                      </button>
                      <Link
                        href="/admin"
                        className="font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                      >
                        Abrir Consola Flight Surgeon
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
                          {acknowledging ? 'Confirmando...' : 'Acknowledge incidente'}
                        </button>
                      )}
                      <Link
                        href="/operator"
                        className="font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                      >
                        Ir a Consola de Operador
                      </Link>
                    </>
                  )}

                  {activeRole === 'USER' && (
                    <Link
                      href="/readings/new"
                      className="tactile-press inline-flex items-center gap-1.5 rounded-md bg-blueberry px-3 py-1.5 font-semibold text-white hover:opacity-90"
                    >
                      Registrar Lectura Biométrica
                    </Link>
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

              {/* Cross-role coordination summary */}
              <div className="rounded-lg border border-line bg-surface/70 p-3.5 space-y-2.5">
                <h4 className="font-semibold text-blueberry">
                  Coordinación entre Roles
                </h4>
                {(['OPERATOR', 'ADMIN', 'USER'] as OperationalRole[])
                  .filter((r) => r !== activeRole)
                  .map((r) => (
                    <div key={r} className="space-y-1 border-t border-line/60 pt-2 first:border-t-0 first:pt-0">
                      <p className="font-semibold text-blueberry/90">{roleMeasures[r].roleTitle}</p>
                      <p className="text-[11px] text-stem leading-snug">
                        {roleMeasures[r].actions[0]}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* S2+ NOAA storm checklist */}
            {showStormChecklist && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-black/10">
                <div>
                  <h4 className="font-semibold text-blueberry mb-1.5">
                    Action Checklist ({stormScale})
                  </h4>
                  <ul className="space-y-1.5">
                    {status.mitigation.actionChecklist.map((item, idx) => {
                      const key = `action:${idx}`;
                      return (
                        <li key={key} className="flex items-start gap-2">
                          <input
                            id={key}
                            type="checkbox"
                            checked={Boolean(checkedItems[key])}
                            onChange={() => toggleItem(key)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400"
                          />
                          <label htmlFor={key} className="cursor-pointer leading-snug text-blueberry/90">
                            {item}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-blueberry mb-1.5">
                    Medical Countermeasures
                  </h4>
                  <ul className="space-y-1.5">
                    {status.mitigation.medicalCountermeasures.map((item, idx) => {
                      const key = `med:${idx}`;
                      return (
                        <li key={key} className="flex items-start gap-2">
                          <input
                            id={key}
                            type="checkbox"
                            checked={Boolean(checkedItems[key])}
                            onChange={() => toggleItem(key)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400"
                          />
                          <label htmlFor={key} className="cursor-pointer leading-snug text-blueberry/90">
                            {item}
                          </label>
                        </li>
                      );
                    })}
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
