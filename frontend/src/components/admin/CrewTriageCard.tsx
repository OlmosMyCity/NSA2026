import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Send } from 'lucide-react';
import { AstronautFallbackAvatar } from '@/components/astronauts/AstronautFallbackAvatar';
import { StatusBadge } from '@/components/health/StatusBadge';
import { evaluateIndicator, worstStatus } from '@/domain/health/evaluate';
import { API_STATUS } from '@/domain/health/api-adapter';
import { STATUS_THEME } from '@/domain/health/status-theme';
import type { HealthStatus, IndicatorId } from '@/domain/health/types';
import type { CrewMemberTriage } from '../../domain/admin/types';

const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });

/** Sin lecturas, los signos son null: se muestra un guion y nunca un valor inventado. */
const NO_VALUE = '—';
const withUnit = (value: number | null, unit: string) => (value === null ? NO_VALUE : `${value}${unit}`);

/** Color de un valor según la misma tabla clínica del backend (verde = color de texto normal). */
function valueColor(status: HealthStatus): string | undefined {
  return status === 'amber' || status === 'red' ? STATUS_THEME[status].color : undefined;
}

function Vital({ label, value, status = 'green' }: { label: string; value: string; status?: HealthStatus }) {
  return (
    <div>
      <span className="text-[11px] text-stem block">{label}</span>
      <span className="font-mono text-sm font-bold tabular-nums text-blueberry" style={{ color: valueColor(status) }}>
        {value}
      </span>
    </div>
  );
}

const statusOf = (id: IndicatorId, value: number | null): HealthStatus =>
  value === null ? 'green' : evaluateIndicator(id, value).status;

interface CrewTriageCardProps {
  member: CrewMemberTriage;
  onIssueDirective: (member: CrewMemberTriage) => void;
}

export function CrewTriageCard({ member, onIssueDirective }: CrewTriageCardProps) {
  const hasNoData = member.status === 'NO_DATA';
  const status: HealthStatus = member.status === 'NO_DATA' ? 'unknown' : API_STATUS[member.status];
  const [systolic, diastolic] = member.bloodPressure ? member.bloodPressure.split('/').map(Number) : [null, null];
  const borderColor = status === 'green' || status === 'unknown' ? undefined : STATUS_THEME[status].border;

  return (
    <article
      className="surface-card flex flex-col justify-between p-6 transition-all duration-ui ease-out-expo hover:shadow-md"
      style={{ borderColor }}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {member.photoUrl ? (
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                <Image src={member.photoUrl} alt={member.astronautName} fill className="object-cover" />
              </div>
            ) : (
              <AstronautFallbackAvatar name={member.astronautName} className="h-14 w-14 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-blueberry">{member.astronautName}</h3>
              <p className="text-xs text-berry truncate">
                {member.role} · {member.missionName}
              </p>
              <span className="mt-0.5 block font-mono text-[11px] text-stem">Habitat: {member.environment ?? '—'}</span>
              {member.adaptedProtocol && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-800 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1">
                  {member.adaptedProtocol}
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {member.priorityBoosted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white tracking-wide">
                P0 · STORM PRIORITY
              </span>
            )}
            <StatusBadge status={status} compact />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
          <Vital label="HR (bpm)" value={withUnit(member.heartRate, ' bpm')} status={statusOf('heartRate', member.heartRate)} />
          <Vital
            label="BP (mmHg)"
            value={member.bloodPressure ?? NO_VALUE}
            status={worstStatus([statusOf('systolic', systolic), statusOf('diastolic', diastolic)])}
          />
          <Vital label="SpO₂ (%)" value={withUnit(member.spo2, '%')} status={statusOf('spo2', member.spo2)} />
          <Vital label="Temp (°C)" value={withUnit(member.temperature, '°C')} status={statusOf('temperature', member.temperature)} />
          <Vital label="Glucose" value={withUnit(member.glucose, ' mg/dL')} status={statusOf('glucose', member.glucose)} />
          <Vital label="Sleep" value={withUnit(member.sleepHours, ' hrs')} status={statusOf('sleepHours', member.sleepHours)} />
          <Vital label="Mood (1–5)" value={withUnit(member.mood, '/5')} status={statusOf('mood', member.mood)} />
          <div>
            <span className="text-[11px] text-stem block">Last Reading</span>
            <span className="font-mono text-xs tabular-nums text-berry">
              {member.lastReadingAt ? timeFmt.format(new Date(member.lastReadingAt)) : 'Never'}
            </span>
            {member.lastReadingAt && !member.isFresh && (
              <span className="mt-0.5 block text-[11px] font-semibold text-status-caution">Expired</span>
            )}
          </div>
        </div>

        {hasNoData && (
          <p className="mt-6 ui-callout text-xs text-stem">
            No health readings on record. Status is unknown until this crew member takes a measurement.
          </p>
        )}

        {member.alerts.length > 0 && (
          <div className="mt-6 space-y-2">
            <span className="text-xs font-semibold text-status-critical block">Active medical alerts</span>
            {member.alerts.map((alert) => (
              <div key={alert} className="ui-callout-critical flex items-center gap-2 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{alert}</span>
              </div>
            ))}
          </div>
        )}

        {member.recommendation && (
          <div className="mt-6 ui-callout text-xs text-blueberry">
            <span className="font-semibold text-berry block mb-0.5">Active clinical directive</span>
            {member.recommendation}
          </div>
        )}
      </div>

      <div className="mt-6 pt-2 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/trends?astronautId=${member.astronautId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-berry hover:text-blueberry underline underline-offset-4"
        >
          <span>Analyze trends</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => onIssueDirective(member)}
          className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-blueberry hover:border-blueberry hover:bg-surface-tinted"
        >
          <Send className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
          <span>Issue Medical Directive</span>
        </button>
      </div>
    </article>
  );
}
