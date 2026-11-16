'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Check, ChevronDown, ChevronUp, StickyNote, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  clearFollowUpNote,
  FOLLOWUP_CHANGE_EVENT,
  loadLatestActiveFollowUpNote,
  toggleFollowUpItem,
  type FollowUpStickyRecord,
} from '@/domain/health/followUpStorage';

const SILENT_ROUTES = ['/readings/new', '/login', '/register'];
const EXIT_MS = 200;

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
  const preferredAstronautId = isAuthenticated ? user?.astronautId ?? undefined : undefined;

  const [note, setNote] = useState<FollowUpStickyRecord | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) {
      setNote(null);
      return;
    }

    const sync = () => {
      const now = Date.now();
      setNowMs(now);
      setNote(loadLatestActiveFollowUpNote(preferredAstronautId, now));
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
  }, [isAuthenticated, preferredAstronautId, pathname]);

  const isSilent = SILENT_ROUTES.some((route) => pathname.startsWith(route));
  if (!note || isSilent) return null;

  const remainingMs = note.expiresAt - nowMs;
  if (remainingMs <= 0) return null;

  const doneCount = note.items.filter((it) => it.done).length;
  const allChecked = note.items.length === 0 || doneCount === note.items.length;

  const dismiss = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      clearFollowUpNote(note.astronautId);
      setIsClosing(false);
    }, EXIT_MS);
  };

  return (
    <aside
      role="status"
      aria-label="Warning follow-up reminder"
      className={`twin-panel fixed bottom-4 left-4 z-40 w-[min(23rem,calc(100vw-2rem))] border-l-4 border-[var(--status-caution)] shadow-lg ${
        isClosing ? 'reminder-exit' : 'reminder-enter'
      }`}
    >
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand follow-up note' : 'Collapse follow-up note'}
            className="min-w-0 flex-1 text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <StickyNote className="h-3.5 w-3.5 shrink-0 text-[var(--status-caution)]" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-caution)]">
                Follow-Up Post-it
              </span>
              <span className="font-mono text-[10px] tabular-nums text-stem">
                {formatCountdown(remainingMs)} left
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-blueberry truncate group-hover:underline underline-offset-2">
              {note.astronautName ? `${note.astronautName} · ${note.title}` : note.title}
            </p>
            {collapsed && (
              <p className="mt-0.5 text-[10px] text-stem">
                Click to expand · {doneCount}/{note.items.length} checked
              </p>
            )}
          </button>

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
              onClick={dismiss}
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
                          ? 'border-[var(--status-nominal)] bg-[var(--status-nominal)] text-canvas'
                          : 'border-stem/60 bg-canvas/40 text-transparent'
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
                {allChecked
                  ? `${doneCount}/${note.items.length} checked`
                  : `${doneCount}/${note.items.length} · Check all to re-check`}
              </span>
              {allChecked ? (
                <Link
                  href={`/readings/new?astronautId=${encodeURIComponent(note.astronautId)}`}
                  className="twin-btn twin-btn-primary text-[11px] py-1 px-2.5"
                >
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  <span>Re-check now</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Check all follow-up steps above before re-checking vitals"
                  className="twin-btn twin-btn-ghost text-[11px] py-1 px-2.5 opacity-45 cursor-not-allowed"
                >
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  <span>Re-check now</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

