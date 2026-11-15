'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { healthService } from '../../services/healthService';
import { useFreshnessPhase } from '../../hooks/useFreshnessPhase';
import { FreshnessRing } from './FreshnessRing';

/** Rutas donde el aviso estorba: ya se está midiendo o no hay sesión. */
const SILENT_ROUTES = ['/readings/new', '/login', '/register'];
const EXIT_MS = 200;

/**
 * Recordatorio de vigencia para el tripulante. Se deriva de la última lectura
 * (no se guarda ni se pospone): avisa 2 min antes y al vencer los 15 min.
 * Descartarlo oculta el aviso, no devuelve la vigencia.
 */
export function FreshnessReminder() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const astronautId = isAuthenticated && user?.role === 'USER' ? user.astronautId : undefined;

  const [takenAt, setTakenAt] = useState<string | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Se vuelve a consultar al navegar: así se reinicia tras registrar una lectura.
  useEffect(() => {
    if (!astronautId) {
      setTakenAt(null);
      return;
    }
    let active = true;
    healthService
      .listReadings(astronautId)
      .then((rows) => {
        if (active) setTakenAt(rows.at(-1)?.takenAt ?? null);
      })
      .catch(() => {
        // Sin conexión se conserva la última lectura conocida.
      });
    return () => {
      active = false;
    };
  }, [astronautId, pathname]);

  const phase = useFreshnessPhase(takenAt);
  const isExpired = phase === 'expired';
  const noticeKey = `${takenAt}:${phase}`;

  const isSilent = SILENT_ROUTES.some((route) => pathname.startsWith(route));
  // En el panel el vencimiento ya se muestra dentro de la página.
  const shownInPage = isExpired && pathname.startsWith('/dashboard');
  const visible =
    !!takenAt && (phase === 'expiring' || isExpired) && !isSilent && !shownInPage && dismissedKey !== noticeKey;

  if (!visible) return null;

  const dismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setDismissedKey(noticeKey);
      setIsClosing(false);
    }, EXIT_MS);
  };

  return (
    <div
      role={isExpired ? 'alert' : 'status'}
      className={`twin-panel fixed right-4 top-20 z-40 flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 p-4 shadow-lg ${
        isClosing ? 'reminder-exit' : 'reminder-enter'
      }`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-blueberry">
          {isExpired ? 'Live vitals expired' : 'Live vitals expire soon'}
        </p>
        <p className="text-xs text-stem">
          {isExpired
            ? 'Your status is unknown until you take a new measurement.'
            : 'Measure again to keep your status current.'}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href="/readings/new" className="twin-btn twin-btn-primary">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Measure now
          </Link>
          <FreshnessRing takenAt={takenAt} />
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss reminder"
        className="twin-btn twin-btn-ghost h-8 w-8 shrink-0 p-0"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
