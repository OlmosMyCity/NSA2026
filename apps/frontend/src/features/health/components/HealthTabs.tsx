'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';

const TABS = [
  { href: '/dashboard', label: 'Anatomical Body' },
  { href: '/trends', label: 'Historical Trends' },
];

export function HealthTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [missionId, setMissionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.astronautId) return;
    astronautService
      .getById(user.astronautId)
      .then((a) => setMissionId(a.missionId))
      .catch(() => setMissionId(null));
  }, [user?.astronautId]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line">
      <nav aria-label="My Health sections" className="flex flex-wrap gap-6">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`ui-tab text-xs font-semibold ${active ? 'ui-tab-active' : ''}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {missionId && (
        <Link
          href={`/missions/${missionId}`}
          className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
        >
          <Rocket className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
          <span>View my active mission</span>
        </Link>
      )}
    </div>
  );
}

