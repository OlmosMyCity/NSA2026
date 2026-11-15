'use client';

import { useEffect, useState } from 'react';
import { serverNow, syncServerClock } from '@/features/common/services/serverClock';
import { EXPIRY_WARNING_MS, evaluateFreshness, type FreshnessPhase } from '../domain/freshness';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Fase de vigencia de una lectura. Solo provoca un render cuando la fase cambia
 * (no cada segundo): programa un temporizador hasta el siguiente cambio.
 */
export function useFreshnessPhase(takenAt: string | null | undefined): FreshnessPhase {
  const [phase, setPhase] = useState<FreshnessPhase>(() => evaluateFreshness(takenAt, serverNow()).phase);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const update = () => {
      if (!active) return;
      clearTimeout(timer);
      const freshness = evaluateFreshness(takenAt, serverNow());
      setPhase(freshness.phase);

      const untilNextPhase =
        freshness.phase === 'fresh'
          ? freshness.remainingMs - EXPIRY_WARNING_MS
          : freshness.phase === 'expiring'
          ? freshness.remainingMs
          : null;
      if (untilNextPhase !== null) {
        timer = setTimeout(update, Math.min(untilNextPhase + 50, MAX_TIMEOUT_MS));
      }
    };

    update();
    void syncServerClock().then(update);
    // Los temporizadores se retrasan en pestañas en segundo plano: se recalcula al volver.
    document.addEventListener('visibilitychange', update);

    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [takenAt]);

  return phase;
}
