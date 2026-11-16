'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, Check, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { API_STATUS } from '../../../domain/health/api-adapter';
import { getMedicalProtocolsForAlerts } from '../../../domain/health/medicalProtocols';
import { STATUS_THEME } from '../../../domain/health/status-theme';
import type { EvaluationResult, Vitals } from '../../../domain/health/types';
import { StatusBadge } from '../StatusBadge';

interface AssessmentPanelProps {
  evaluation: EvaluationResult;
  vitals: Vitals;
  astronautName: string | undefined;
}

/** Vista previa del veredicto (misma tabla clínica que usa el backend al guardar). */
export function AssessmentPanel({ evaluation, vitals, astronautName }: AssessmentPanelProps) {
  const status = API_STATUS[evaluation.status];
  const protocols = getMedicalProtocolsForAlerts(evaluation.alerts);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const summary: Array<[string, string]> = [
    ['Heart Rate', `${vitals.heartRateBpm} bpm`],
    ['Blood Pressure', `${vitals.systolicMmHg}/${vitals.diastolicMmHg}`],
    ['Glucose', `${vitals.glucoseMgDl} mg/dL`],
    ['Temperature', `${vitals.temperatureC} °C`],
    ['O₂ Saturation', `${vitals.spo2Pct} %`],
    ['Sleep', `${vitals.sleepHours} h`],
    ['Mood', `Level ${vitals.mood}/5`],
  ];

  return (
    <div className="space-y-8 animate-materialize">
      <div className="border-l-2 pl-4 space-y-4" style={{ borderColor: STATUS_THEME[status].color }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blueberry" />
            <span className="text-sm font-bold text-blueberry">Autonomous Onboard Assessment</span>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-blueberry block">Identified physiological alerts:</span>
          {evaluation.alerts.length === 0 ? (
            <p className="text-sm text-status-nominal flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              All 7 vitals nominal.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {evaluation.alerts.map((alert) => (
                <li key={alert.indicator} className="text-xs text-blueberry flex items-start gap-2">
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

        <div>
          <span className="text-xs font-semibold text-berry block mb-1">Flight Medical Recommendation</span>
          <p className="text-sm text-blueberry leading-relaxed">{evaluation.recommendation}</p>
        </div>

        {protocols.length > 0 && (
          <div className="border-t border-line pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-berry" />
              <span className="text-xs font-semibold text-blueberry">
                Immediate Guided Steps (Non-Physician Crew Action)
              </span>
            </div>

            <div className="space-y-4">
              {protocols.map((protocol) => {
                const doneCount = protocol.steps.filter((_, idx) => checkedSteps[`${protocol.protocolId}-${idx}`]).length;
                return (
                  <div key={protocol.protocolId} className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-blueberry">{protocol.title}</span>
                      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-stem">
                        <span>Recheck {protocol.recheckIn}</span>
                        <span>
                          {doneCount}/{protocol.steps.length}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-1.5">
                      {protocol.steps.map((stepText, idx) => {
                        const key = `${protocol.protocolId}-${idx}`;
                        const checked = Boolean(checkedSteps[key]);
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => toggleStep(key)}
                              aria-pressed={checked}
                              className="tactile-press w-full flex items-start gap-2.5 text-left py-1 rounded transition-[opacity,color] duration-150 ease-out hover:text-blueberry"
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-150 ease-out ${
                                  checked
                                    ? 'border-status-nominal bg-status-nominal text-white'
                                    : 'border-line bg-transparent text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" strokeWidth={2.5} />
                              </span>
                              <span
                                className={`text-xs leading-relaxed transition-[color,opacity] duration-150 ease-out ${
                                  checked ? 'line-through text-stem opacity-75' : 'text-blueberry'
                                }`}
                              >
                                <span className="font-mono text-[11px] text-stem mr-1.5 tabular-nums">
                                  {idx + 1}.
                                </span>
                                {stepText}
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
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 text-xs pt-2">
        {summary.map(([label, value]) => (
          <div key={label}>
            <span className="text-stem block text-[11px]">{label}</span>
            <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">{value}</strong>
          </div>
        ))}
        <div>
          <span className="text-stem block text-[11px]">Astronaut</span>
          <strong className="text-berry text-xs truncate block mt-1">{astronautName ?? '—'}</strong>
        </div>
      </div>
    </div>
  );
}
