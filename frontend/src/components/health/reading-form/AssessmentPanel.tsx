'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { API_STATUS } from '../../../domain/health/api-adapter';
import { INDICATOR_GUIDES } from '../../../domain/health/education';
import { nominalLabel } from '../../../domain/health/evaluate';
import { loadActiveFollowUpNote, setFollowUpItemDone } from '../../../domain/health/followUpStorage';
import { INDICATORS } from '../../../domain/health/indicators';
import {
  getMedicalProtocolsForAlerts,
  getRecheckFieldsForProtocols,
} from '../../../domain/health/medicalProtocols';
import { STATUS_THEME } from '../../../domain/health/status-theme';
import type { EvaluationResult, Vitals } from '../../../domain/health/types';
import { StatusBadge } from '../StatusBadge';

export type CriticalVerificationPhase =
  | 'idle'
  | 'stabilized'
  | 'confirmed_critical'
  | 'emergency_bypass';

interface AssessmentPanelProps {
  evaluation: EvaluationResult;
  vitals: Vitals;
  astronautId?: string | null;
  astronautName: string | undefined;
  verificationPhase: CriticalVerificationPhase;
  onApplyRecheck: (updatedVitals: Vitals) => void;
  onEmergencyBypass: () => void;
  onCheckedStepsChange?: (steps: Record<string, boolean>) => void;
}

/** Vista previa del veredicto (misma tabla clínica que usa el backend al guardar). */
export function AssessmentPanel({
  evaluation,
  vitals,
  astronautId,
  astronautName,
  verificationPhase,
  onApplyRecheck,
  onEmergencyBypass,
  onCheckedStepsChange,
}: AssessmentPanelProps) {
  const status = API_STATUS[evaluation.status];
  const protocols = useMemo(
    () => getMedicalProtocolsForAlerts(evaluation.alerts),
    [evaluation.alerts]
  );
  const recheckFields = useMemo(
    () => getRecheckFieldsForProtocols(protocols),
    [protocols]
  );

  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [recheckDraft, setRecheckDraft] = useState<Vitals>(vitals);

  useEffect(() => {
    setRecheckDraft(vitals);
  }, [vitals]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    if (astronautId) {
      const existing = loadActiveFollowUpNote(astronautId);
      if (existing) {
        for (const item of existing.items) {
          if (item.done) initial[item.id] = true;
        }
      }
    }
    setCheckedSteps(initial);
    onCheckedStepsChange?.(initial);
  }, [evaluation.alerts, astronautId, astronautName, onCheckedStepsChange]);

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => {
      const nextVal = !prev[key];
      const next = { ...prev, [key]: nextVal };
      if (astronautId) {
        setFollowUpItemDone(astronautId, key, nextVal);
      }
      onCheckedStepsChange?.(next);
      return next;
    });
  };

  const totalSteps = protocols.reduce((acc, p) => acc + p.steps.length, 0);
  const completedSteps = protocols.reduce(
    (acc, p) =>
      acc + p.steps.filter((_, idx) => checkedSteps[`${p.protocolId}-${idx}`]).length,
    0
  );
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
  const isCritical = evaluation.status === 'CRITICAL';
  const isWarning = evaluation.status === 'WARNING';

  const summary: Array<[string, string]> = [
    ['Heart Rate', `${vitals.heartRateBpm} bpm`],
    ['Blood Pressure', `${vitals.systolicMmHg}/${vitals.diastolicMmHg}`],
    ['Glucose', `${vitals.glucoseMgDl} mg/dL`],
    ['Temperature', `${vitals.temperatureC} °C`],
    ['O₂ Saturation', `${vitals.spo2Pct} %`],
    ['Sleep', `${vitals.sleepHours} h`],
    ['Mood', `Level ${vitals.mood}/5`],
  ];

  const heroStyle = isCritical
    ? {
        backgroundColor: 'var(--status-critical-bg)',
        borderColor: 'var(--status-critical-border)',
      }
    : isWarning
      ? {
          backgroundColor: 'var(--status-caution-bg)',
          borderColor: 'var(--status-caution-border)',
        }
      : undefined;

  return (
    <div className="space-y-8 animate-materialize">
      {/* Stabilized banner when a critical re-check improved to OK/WARNING */}
      {verificationPhase === 'stabilized' && !isCritical && (
        <div
          role="status"
          className="rounded-lg border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] px-4 py-3 flex items-start gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-status-nominal shrink-0 mt-0.5" />
          <div className="text-xs text-blueberry leading-relaxed">
            <strong className="block font-bold text-status-nominal">
              Stabilized on Verification Check
            </strong>
            Values improved after stabilization steps ({status === 'green' ? 'Nominal' : 'Watch — 15-min Follow-Up Post-it will stay pinned'}). You can now save this reading.
          </div>
        </div>
      )}

      {/* High-contrast Priority Action Callout (Critical / Warning) or Clean Nominal Header */}
      <div
        className={`rounded-lg border border-l-4 p-4 sm:p-5 space-y-4 ${
          !heroStyle ? 'border-line bg-surface-tinted/20' : ''
        }`}
        style={{
          ...(heroStyle ?? {}),
          borderLeftColor: STATUS_THEME[status].color,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isCritical ? (
              <AlertOctagon className="h-5 w-5 text-[var(--status-critical)] shrink-0" />
            ) : isWarning ? (
              <AlertTriangle className="h-5 w-5 text-[var(--status-caution)] shrink-0" />
            ) : (
              <Activity className="h-4 w-4 text-blueberry shrink-0" />
            )}
            <span className="text-sm sm:text-base font-bold text-blueberry">
              {isCritical
                ? verificationPhase === 'confirmed_critical'
                  ? 'CONFIRMED CRITICAL — EMERGENCY PROTOCOL ACTIVE'
                  : verificationPhase === 'emergency_bypass'
                    ? 'EMERGENCY BYPASS — SAVE & ESCALATE NOW'
                    : 'CRITICAL ACTION REQUIRED — STABILIZE & VERIFY'
                : isWarning
                  ? 'CAUTION — ACT & RE-CHECK WITHIN 15 MIN'
                  : 'Autonomous Onboard Assessment'}
            </span>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-blueberry block">
            Identified physiological alerts:
          </span>
          {evaluation.alerts.length === 0 ? (
            <p className="text-sm text-status-nominal flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              All 7 vitals nominal.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {evaluation.alerts.map((alert) => (
                <li
                  key={alert.indicator}
                  className="text-xs sm:text-sm font-medium text-blueberry flex items-start gap-2"
                >
                  <AlertTriangle
                    className="h-4 w-4 flex-shrink-0 mt-0.5"
                    style={{ color: STATUS_THEME[API_STATUS[alert.level]].color }}
                  />
                  <span>{alert.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line/60 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-berry block mb-1">
            Primary Directive
          </span>
          <p className="text-sm font-medium text-blueberry leading-relaxed">
            {verificationPhase === 'confirmed_critical'
              ? 'Confirmed critical across 2 consecutive checks (not a sensor artifact). Notify the Flight Surgeon immediately, suspend EVA, and keep the crewmember stabilized.'
              : evaluation.recommendation}
          </p>
          {isWarning && (
            <p className="mt-2 text-xs text-stem">
              Saving now will pin a <strong>15-minute Follow-Up Post-it</strong> so you remember to repeat this measurement.
            </p>
          )}
        </div>
      </div>

      {/* Step-by-Step Guided Actions with inline "How:" instructions */}
      {protocols.length > 0 && (
        <div className="border-l-2 border-berry/70 pl-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-berry" />
              <span className="text-sm font-bold text-blueberry">
                {isCritical
                  ? 'Step 1 of 2 · Immediate Stabilization Checklist'
                  : 'Recommended Action Checklist (Optional Before Saving)'}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-blueberry">
              {completedSteps}/{totalSteps} done
            </span>
          </div>

          <div className="space-y-5">
            {protocols.map((protocol) => (
              <div key={protocol.protocolId} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-blueberry">{protocol.title}</span>
                  <span className="text-[11px] font-mono tabular-nums text-stem">
                    Recheck in {protocol.recheckIn}
                  </span>
                </div>

                <ul className="space-y-2">
                  {protocol.steps.map((step, idx) => {
                    const key = `${protocol.protocolId}-${idx}`;
                    const checked = Boolean(checkedSteps[key]);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => toggleStep(key)}
                          aria-pressed={checked}
                          className="tactile-press w-full flex items-start gap-3 text-left p-2.5 rounded-md border border-line/70 bg-surface-tinted/20 hover:border-stem/60 transition-[transform,border-color,background-color,opacity] duration-150 ease-out"
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-150 ease-out ${
                              checked
                                ? 'border-[var(--status-nominal)] bg-[var(--status-nominal)] text-canvas'
                                : 'border-stem/60 bg-canvas/40 text-transparent'
                            }`}
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-xs sm:text-sm font-medium leading-snug transition-[color,opacity] duration-150 ease-out ${
                                checked ? 'line-through text-stem opacity-70' : 'text-blueberry'
                              }`}
                            >
                              <span className="font-mono text-[11px] text-stem mr-1.5 tabular-nums">
                                {idx + 1}.
                              </span>
                              {step.action}
                            </span>
                            {step.howTo && (
                              <span className="block text-[11px] text-stem leading-relaxed mt-1">
                                <strong className="font-semibold text-berry">How:</strong> {step.howTo}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <p className="text-[11px] text-berry leading-relaxed">
                  <strong className="font-semibold">Escalate if:</strong> {protocol.escalateIf}
                </p>
                <p className="text-[10px] font-mono text-stem">Ref: {protocol.reference}</p>
              </div>
            ))}
          </div>

          {/* Bounded Step 2 of 2: Inline Re-measure & Verify Loop (CRITICAL only, max 1 pass) */}
          {isCritical && verificationPhase === 'idle' && recheckFields.length > 0 && (
            <div className="rounded-lg border border-line bg-surface-tinted/35 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-berry" />
                  <span className="text-xs sm:text-sm font-bold text-blueberry">
                    Step 2 of 2 · Verify &amp; Re-measure Affected Vitals
                  </span>
                </div>
                <span className="text-[11px] font-mono text-stem">
                  {allStepsDone ? 'Ready to verify' : `Complete ${totalSteps - completedSteps} step(s) above first`}
                </span>
              </div>

              <p className="text-xs text-stem leading-relaxed">
                Re-enter only the targeted vital(s) below to confirm whether the critical alert was a sensor artifact / transient spike or an active emergency.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recheckFields.map(({ indicator, field }) => {
                  const def = INDICATORS[indicator];
                  const howLine = INDICATOR_GUIDES[indicator].howToMeasure[0];
                  const val = recheckDraft[field];
                  return (
                    <div key={field} className="space-y-1">
                      <label
                        htmlFor={`recheck-${field}`}
                        className="block text-xs font-semibold text-blueberry"
                      >
                        {def.label} ({def.unit})
                      </label>
                      <p className="text-[11px] text-stem leading-snug">{howLine}</p>
                      <input
                        id={`recheck-${field}`}
                        type="number"
                        min={def.input.min}
                        max={def.input.max}
                        step={def.input.step}
                        value={Number.isFinite(val) ? val : ''}
                        disabled={!allStepsDone}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (allStepsDone) onApplyRecheck(recheckDraft);
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setRecheckDraft((prev) => ({
                            ...prev,
                            [field]: raw === '' ? Number.NaN : Number(raw),
                          }));
                        }}
                        className="mt-1 w-full border-0 border-b border-line bg-transparent py-1.5 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none disabled:opacity-45"
                      />
                      <span className="block text-[10px] text-stem tabular-nums">
                        Nominal: {nominalLabel(indicator)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  disabled={!allStepsDone}
                  onClick={() => onApplyRecheck(recheckDraft)}
                  className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-evaluate Vitals</span>
                </button>

                <button
                  type="button"
                  onClick={onEmergencyBypass}
                  className="tactile-press inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-critical)] hover:underline"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Crewmate unresponsive? Skip re-check &amp; unlock Save now</span>
                </button>
              </div>
            </div>
          )}

          {/* If CRITICAL only involves behavioral fields with no sensor loop, allow direct verification */}
          {isCritical && verificationPhase === 'idle' && recheckFields.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={!allStepsDone}
                onClick={() => onApplyRecheck(recheckDraft)}
                className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-45"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Confirm Support Steps Completed</span>
              </button>
              <button
                type="button"
                onClick={onEmergencyBypass}
                className="tactile-press inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-critical)] hover:underline"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Skip &amp; unlock Save immediately</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Vitals Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 text-xs pt-2 border-t border-line">
        {summary.map(([label, value]) => (
          <div key={label}>
            <span className="text-stem block text-[11px]">{label}</span>
            <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
              {value}
            </strong>
          </div>
        ))}
        <div>
          <span className="text-stem block text-[11px]">Astronaut</span>
          <strong className="text-berry text-xs truncate block mt-1">
            {astronautName ?? '—'}
          </strong>
        </div>
      </div>
    </div>
  );
}
