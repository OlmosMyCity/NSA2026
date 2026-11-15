'use client';

/**
 * @module components/health/HealthTabs
 * Sub-navigation bar across My Health views (`/dashboard`, `/trends`)
 * with quick shortcuts to Log Reading and the crew member's active mission.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { HeartPulse, Rocket } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import { missionService } from '@/services/missionService';

const TABS = [
  { href: '/dashboard', label: 'My Health' },
  { href: '/trends', label: 'Historical Trends' },
];

/** Route tabs for My Health and contextual active-mission link. */
export function HealthTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  // El ADMIN navega entre pestañas sin perder al tripulante seleccionado.
  const query = useSearchParams().toString();
  const [missionId, setMissionId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function resolveMission() {
      if (user?.astronautId) {
        try {
          const astro = await astronautService.getById(user.astronautId);
          if (alive && astro.missionId) {
            setMissionId(astro.missionId);
            return;
          }
        } catch {
          // Fallback to active mission list
        }
      }

      try {
        const res = await missionService.list({ limit: 10 });
        const active = res.data.find((m) => m.status === 'IN_PROGRESS') ?? res.data[0];
        if (alive) setMissionId(active?.id ?? null);
      } catch {
        if (alive) setMissionId(null);
      }
    }

    resolveMission();
    return () => {
      alive = false;
    };
  }, [user?.astronautId]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line">
      <nav aria-label="My Health sections" className="flex flex-wrap gap-6">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={query ? `${t.href}?${query}` : t.href}
              aria-current={active ? 'page' : undefined}
              className={`ui-tab text-xs font-semibold ${active ? 'ui-tab-active' : ''}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {missionId && (
          <Link
            href={`/missions/${missionId}`}
            className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
          >
            <Rocket className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
            <span>View my active mission</span>
          </Link>
        )}
        <Link
          href="/readings/new"
          className="tactile-press inline-flex items-center gap-1.5 rounded-pill bg-plate px-3.5 py-1.5 text-xs font-semibold text-ink-inverse hover:bg-yogurt"
        >
          <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Log Reading</span>
        </Link>
      </div>
    </div>
  );
}

