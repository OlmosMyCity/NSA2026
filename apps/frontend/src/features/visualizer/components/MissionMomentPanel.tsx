import Link from 'next/link';
import { Clock } from 'lucide-react';
import { toIndicatorReadings } from '@/features/health/domain/api-adapter';
import { BODY_ZONES } from '@/features/health/domain/education';
import { summarizeZones } from '@/features/health/domain/summary';
import type { BodyZoneId } from '@/features/health/domain/types';
import { StatusBadge } from '@/features/health/components/StatusBadge';
import { formatMET, type MissionPhase, type TimelineReading } from '../domain/missionClock';
import { PHASE_WATCH } from '../domain/phaseHazards';

const ZONE_ORDER: BodyZoneId[] = ['heart', 'blood', 'brain', 'sleep', 'bones'];

const PHASE_NAME_EN: Record<string, string> = {
  Ascenso: 'Ascent',
  'Órbita de aparcamiento': 'Parking Orbit',
  'Tránsito translunar': 'Trans-Lunar Transit',
  'NRHO de Gateway': 'Gateway NRHO',
  'Órbita de descenso (HLS)': 'HLS Descent Orbit',
  'Descenso propulsado (HLS)': 'Powered Descent (HLS)',
};
const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

interface MissionMomentPanelProps {
  met: number;
  nowMet: number;
  phase: MissionPhase | null;
  reading: TimelineReading | null;
}

/** Snapshot at this mission elapsed time: flight phase and latest physiological status. */
export function MissionMomentPanel({ met, nowMet, phase, reading }: MissionMomentPanelProps) {
  const watch = PHASE_WATCH[phase?.id ?? ''] ?? [];
  const future = met > nowMet + 60;
  const zones = reading ? summarizeZones(toIndicatorReadings(reading.reading)) : null;
  const gapDays = reading ? (met - reading.met) / 86400 : 0;

  return (
    <div className="space-y-6 p-6" aria-live="polite">
      <header>
        <p className="text-xs font-medium text-stem">
          {future ? 'Later in mission' : 'Status at'}
        </p>
        <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-blueberry">
          {formatMET(met)}
        </p>
        <p className="mt-0.5 text-sm font-medium text-berry">
          {phase ? (PHASE_NAME_EN[phase.name] ?? phase.name) : 'Pre-launch'}
        </p>
      </header>

      {future ? (
        <p className="ui-callout flex items-start gap-2 text-xs leading-relaxed text-berry">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-stem" aria-hidden="true" />
          Planned trajectory ahead. Health metrics will appear once the mission reaches this point.
        </p>
      ) : reading && zones ? (
        <section aria-labelledby="moment-health">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="moment-health" className="text-sm font-bold text-blueberry">
              Your Health
            </h3>
            <span className="text-[11px] tabular-nums text-stem">
              {dateFmt.format(Date.parse(reading.reading.takenAt))}
            </span>
          </div>
          {gapDays > 1 && (
            <p className="mt-1 text-xs text-stem">
              Latest reading prior to this point ({Math.floor(gapDays)}{' '}
              {Math.floor(gapDays) === 1 ? 'day' : 'days'} earlier).
            </p>
          )}
          <ul className="mt-4 space-y-2.5">
            {ZONE_ORDER.map((z) => {
              const watched = watch.includes(z);
              return (
                <li key={z} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium text-blueberry">
                    {BODY_ZONES[z].label}
                    {watched && (
                      <span className="ml-2 text-[11px] font-normal text-stem">
                        monitor in this phase
                      </span>
                    )}
                  </span>
                  <StatusBadge status={zones[z].status} compact />
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-xs font-semibold text-blueberry underline underline-offset-4 hover:text-berry"
          >
            Inspect on body model
          </Link>
        </section>
      ) : (
        <p className="text-sm text-stem">No readings recorded prior to this point.</p>
      )}
    </div>
  );
}
