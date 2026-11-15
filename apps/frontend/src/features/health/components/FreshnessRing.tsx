'use client';

import { useEffect, useState } from 'react';
import { serverNow } from '@/features/common/services/serverClock';
import { evaluateFreshness, formatCountdown, type FreshnessPhase } from '../domain/freshness';

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PHASE_COLOR: Record<FreshnessPhase, string> = {
  none: 'var(--color-stem)',
  fresh: 'var(--status-nominal)',
  expiring: 'var(--status-caution)',
  expired: 'var(--color-stem)',
};

/**
 * Cuenta regresiva de vigencia de los signos vivos. Hace su propio tic por segundo
 * para no volver a renderizar el panel completo.
 */
export function FreshnessRing({ takenAt }: { takenAt: string | null | undefined }) {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    setNow(serverNow());
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, [takenAt]);

  const { phase, remainingMs, remainingRatio } = evaluateFreshness(takenAt, now);
  if (phase === 'none') return null;

  const color = PHASE_COLOR[phase];
  const label =
    phase === 'expired'
      ? 'Expired'
      : phase === 'expiring'
      ? `Expires in ${formatCountdown(remainingMs)}`
      : `Valid ${formatCountdown(remainingMs)}`;

  return (
    <span
      role="timer"
      aria-label={phase === 'expired' ? 'Live vitals expired' : `Live vitals valid for ${formatCountdown(remainingMs)}`}
      className="inline-flex items-center gap-2"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="-rotate-90">
        <circle cx="9" cy="9" r={RADIUS} fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
        {phase !== 'expired' && (
          <circle
            cx="9"
            cy="9"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - remainingRatio)}
            className="freshness-arc"
          />
        )}
      </svg>
      <span className="twin-value text-xs font-bold" style={{ color }}>
        {label}
      </span>
    </span>
  );
}
