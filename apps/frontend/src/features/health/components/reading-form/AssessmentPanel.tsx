import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { API_STATUS } from '../../domain/api-adapter';
import { STATUS_THEME } from '../../domain/status-theme';
import type { EvaluationResult, Vitals } from '../../domain/types';
import { StatusBadge } from '../StatusBadge';

interface AssessmentPanelProps {
  evaluation: EvaluationResult;
  vitals: Vitals;
  astronautName: string | undefined;
}

/** Vista previa del veredicto (misma tabla clínica que usa el backend al guardar). */
export function AssessmentPanel({ evaluation, vitals, astronautName }: AssessmentPanelProps) {
  const status = API_STATUS[evaluation.status];
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
