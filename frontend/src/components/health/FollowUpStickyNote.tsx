'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Check, ChevronDown, ChevronUp, StickyNote, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  clearFollowUpNote,
  FOLLOWUP_CHANGE_EVENT,
  loadActiveFollowUpNote,
  toggleFollowUpItem,
  type FollowUpStickyRecord,
} from '@/domain/health/followUpStorage';

const SILENT_ROUTES = ['/readings/new', '/login', '/register'];

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Floating 15-minute follow-up "Post-it" shown after saving a WARNING reading
 * without blocking the crew workflow. Auto-clears once expired or resolved by an OK check.
 */
export function FollowUpStickyNote() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const astronautId = isAuthenticated && user?.role === 'USER' ? user.astronautId : undefined;

  const [note, setNote] = useState<FollowUpStickyRecord | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!astronautId) {
      setNote(null);
      return;
    }

    const sync = () => {
      const now = Date.now();
      setNowMs(now);
      setNote(loadActiveFollowUpNote(astronautId, now));
    };

    sync();
    window.addEventListener(FOLLOWUP_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    const timer = window.setInterval(sync, 1000);

    return () => {
      window.removeEventListener(FOLLOWUP_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.clearInterval(timer);
    };
  }, [astronautId, pathname]);

  const isSilent = SILENT_ROUTES.some((route) => pathname.startsWith(route));
  if (!note || isSilent) return null;

  const remainingMs = note.expiresAt - nowMs;
  if (remainingMs <= 0) return null;

  const doneCount = note.items.filter((it) => it.done).length;

  return (
    <aside
      role="status"
      aria-label="Warning follow-up reminder"
      className="twin-panel reminder-enter fixed bottom-4 left-4 z-40 w-[min(23rem,calc(100vw-2rem))] border-l-4 border-[var(--status-caution)] shadow-lg"
    >
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StickyNote className="h-3.5 w-3.5 shrink-0 text-[var(--status-caution)]" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-caution)]">
                Follow-Up Post-it
              </span>
              <span className="font-mono text-[10px] tabular-nums text-stem">
                {formatCountdown(remainingMs)} left
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-blueberry truncate">{note.title}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand follow-up note' : 'Collapse follow-up note'}
              className="twin-btn twin-btn-ghost h-7 w-7 p-0"
            >
              {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => clearFollowUpNote(note.astronautId)}
              aria-label="Dismiss follow-up reminder"
              className="twin-btn twin-btn-ghost h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            <ul className="space-y-1.5 border-t border-line pt-2">
              {note.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = toggleFollowUpItem(note.astronautId, item.id);
                      if (updated) setNote(updated);
                    }}
                    aria-pressed={item.done}
                    className="tactile-press w-full flex items-start gap-2 text-left py-0.5 transition-[opacity,color] duration-150 ease-out"
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-150 ease-out ${
                        item.done
                          ? 'border-status-nominal bg-status-nominal text-white'
                          : 'border-line bg-transparent text-transparent'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[11px] leading-snug ${
                          item.done ? 'line-through text-stem opacity-70' : 'text-blueberry'
                        }`}
                      >
                        {item.text}
                      </span>
                      {item.howTo && !item.done && (
                        <span className="block text-[10px] text-stem leading-snug mt-0.5">
                          How: {item.howTo}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="font-mono text-[10px] tabular-nums text-stem">
                {doneCount}/{note.items.length} checked
              </span>
              <Link href="/readings/new" className="twin-btn twin-btn-primary text-[11px] py-1 px-2.5">
                <Activity className="h-3 w-3" aria-hidden="true" />
                <span>Re-check now</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

