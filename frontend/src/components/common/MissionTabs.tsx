'use client';

/**
 * @module components/common/MissionTabs
 * Sub-navigation bar unifying Step 4 operational surfaces (`/missions`, `/visualizer`,
 * `/astronauts`, and `/profile`) with a quick return to the Step 2 Digital Twin.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MissionTab {
  href: string;
  label: string;
  crewOnly?: boolean;
}

const TABS: MissionTab[] = [
  { href: '/missions', label: 'Missions' },
  { href: '/visualizer', label: '3D Orbit & Radiation' },
  { href: '/astronauts', label: 'Crew Roster', crewOnly: true },
  { href: '/profile', label: 'Biometric ID', crewOnly: true },
];

/** Route tabs for the Mission workspace, filtering crew/biometric views for operators. */
export function MissionTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';

  const visibleTabs = isOperator ? TABS.filter((t) => !t.crewOnly) : TABS;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line">
      <nav aria-label="Mission sections" className="flex flex-wrap gap-6">
        {visibleTabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
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

      {!isOperator && (
        <Link
          href="/dashboard"
          className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-stem transition-colors hover:text-blueberry"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Digital Twin</span>
        </Link>
      )}
    </div>
  );
}

