'use client';

/**
 * @module components/health/ReadingTabs
 * Sub-navigation bar unifying vital recording modes (`/readings/new` and `/vision`)
 * with a direct link to My Health.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

const TABS = [
  { href: '/readings/new', label: 'Manual Vital Entry' },
  { href: '/vision', label: 'Optical Scan (Camera)' },
];

/** Route tabs for Log Reading and quick navigation to My Health. */
export function ReadingTabs() {
  const pathname = usePathname();
  const astronautId = useSearchParams().get('astronautId');
  const query = astronautId ? `astronautId=${encodeURIComponent(astronautId)}` : '';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line">
      <nav aria-label="Log Reading sections" className="flex flex-wrap gap-6">
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

      <Link
        href={query ? `/dashboard?${query}` : '/dashboard'}
        className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-stem transition-colors hover:text-blueberry"
      >
        <span>My Health</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
