'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

/**
 * Global solar radiation status banner polled every 60s.
 * Surfaces NOAA S-scale alerts, X-ray/proton flux telemetry, and for S2+ storms
 * requires completion of all action and medical countermeasure checklist items
 * before allowing incident acknowledgement.
 */
export function RadiationStatusBanner() {
  const [status, setStatus] = useState<RadiationStatusResponse | null>(null);
  const [incident, setIncident] = useState<RadiationIncident | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  const loadRadiation = useCallback(async () => {
    try {
      const nextStatus = await radiationService.getStatus();
      setStatus(nextStatus);

      if (S2_OR_HIGHER.has(nextStatus.currentTelemetry.stormScale)) {
        const activeIncident = await radiationService.getActiveRadiationIncident().catch(() => null);
        setIncident(activeIncident);
      } else {
        setIncident(null);
      }
    } catch {
      // Fail silently so navigation remains unblocked if the radiation service is restarting
    }
  }, []);

  useEffect(() => {
    loadRadiation();
    const timer = setInterval(loadRadiation, 60_000);
    return () => clearInterval(timer);
  }, [loadRadiation]);

  const stormScale: NOAAStormScale = status?.currentTelemetry.stormScale ?? 'S0_NOMINAL';
  const showChecklist = S2_OR_HIGHER.has(stormScale);
  const style = SCALE_STYLES[stormScale];

  const allChecklistKeys = useMemo(() => {
    if (!status || !showChecklist) return [];
    return [
      ...status.mitigation.actionChecklist.map((_, idx) => `action:${idx}`),
      ...status.mitigation.medicalCountermeasures.map((_, idx) => `med:${idx}`),
    ];
  }, [status, showChecklist]);

  const checkedCount = useMemo(
    () => allChecklistKeys.filter((k) => checkedItems[k]).length,
    [allChecklistKeys, checkedItems]
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

  if (!status) return null;

  const proton10 = status.currentTelemetry.latestProtons?.find((p) =>
    p.energyChannel.includes('10')
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
            {status.earlyWarning?.isWarningActive && status.earlyWarning.triggerEvent && (
              <span className="text-amber-900 font-medium">
                ⚠ {status.earlyWarning.triggerEvent}
              </span>
            )}
          </div>

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
        </div>

        {showChecklist && (
          <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-blueberry/75 font-mono">
                  Confirmación: {checkedCount}/{allChecklistKeys.length}
                </span>

                {incident && incident.status === 'OPEN' && (
                  <button
                    type="button"
                    disabled={!allConfirmed || acknowledging}
                    onClick={handleAcknowledge}
                    className="px-3 py-1 rounded-md font-semibold bg-blueberry text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
                  >
                    {acknowledging ? 'Confirmando...' : 'Acknowledge incidente'}
                  </button>
                )}
              </div>

              {ackError && <p className="mt-1 text-rose-700">{ackError}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
