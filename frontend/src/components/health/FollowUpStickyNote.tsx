'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
  StickyNote,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  clearFollowUpNote,
  FOLLOWUP_CHANGE_EVENT,
  loadLatestActiveFollowUpNote,
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
 * Persistent 15-minute follow-up "Post-it" shown after saving a WARNING reading.
 * Cannot be dismissed or hidden manually: stays compact (expandable to a modal)
 * across reloads/logins until resolved or measured after expiry.
 */
export function FollowUpStickyNote() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const preferredAstronautId = isAuthenticated ? user?.astronautId ?? undefined : undefined;

  const [note, setNote] = useState<FollowUpStickyRecord | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) {
      setNote(null);
      setExpanded(false);
      return;
    }

    const sync = () => {
      setNowMs(Date.now());
      setNote(loadLatestActiveFollowUpNote(preferredAstronautId));
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
  const isExpired = remainingMs <= 0;
  const doneCount = note.items.filter((it) => it.done).length;
  const allChecked = note.items.length === 0 || doneCount === note.items.length;

  const reviewHref = `/readings/new?astronautId=${encodeURIComponent(note.astronautId)}&step=review`;
  const recheckHref = `/readings/new?astronautId=${encodeURIComponent(note.astronautId)}`;

  const handleMeasureAfterExpiry = () => {
    clearFollowUpNote(note.astronautId);
    setExpanded(false);
    router.push(recheckHref);
  };

  const renderChecklist = (showHowAlways: boolean) => (
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
                className={`block ${showHowAlways ? 'text-xs' : 'text-[11px]'} leading-snug ${
                  item.done ? 'line-through text-stem opacity-70' : 'text-blueberry'
                }`}
              >
                {item.text}
              </span>
              {item.howTo && (showHowAlways || !item.done) && (
                <span className="block text-[10px] text-stem leading-snug mt-0.5">
                  How: {item.howTo}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const renderActionButton = () => {
    if (isExpired) {
      return (
        <button
          type="button"
          onClick={handleMeasureAfterExpiry}
          className="twin-btn twin-btn-primary text-[11px] py-1 px-2.5"
        >
          <Activity className="h-3 w-3" aria-hidden="true" />
          <span>Measure now</span>
        </button>
      );
    }

    if (allChecked) {
      return (
        <Link href={recheckHref} className="twin-btn twin-btn-primary text-[11px] py-1 px-2.5">
          <Activity className="h-3 w-3" aria-hidden="true" />
          <span>Re-check now</span>
        </Link>
      );
    }

    return (
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
    );
  };

  if (expanded) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Follow-up action checklist"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        onClick={() => setExpanded(false)}
      >
        <div
          className={`twin-panel w-full max-w-lg border-l-4 shadow-2xl p-5 space-y-4 ${
            isExpired ? 'border-[var(--status-critical)]' : 'border-[var(--status-caution)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StickyNote
                  className={`h-4 w-4 shrink-0 ${
                    isExpired ? 'text-[var(--status-critical)]' : 'text-[var(--status-caution)]'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isExpired ? 'text-[var(--status-critical)]' : 'text-[var(--status-caution)]'
                  }`}
                >
                  {isExpired ? 'Follow-Up Expired' : 'Follow-Up Post-it'}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-stem">
                  {isExpired ? '00:00 · Measurement due' : `${formatCountdown(remainingMs)} left`}
                </span>
              </div>

              <Link
                href={reviewHref}
                onClick={() => setExpanded(false)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-blueberry hover:underline underline-offset-2"
              >
                <span>{note.astronautName ? `${note.astronautName} · ${note.title}` : note.title}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stem" aria-hidden="true" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Minimize follow-up modal"
              title="Minimize to corner Post-it"
              className="twin-btn twin-btn-ghost h-8 w-8 p-0 shrink-0"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {renderChecklist(true)}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <span className="font-mono text-[11px] tabular-nums text-stem">
              {isExpired
                ? 'Window expired — measure vitals now'
                : allChecked
                  ? `${doneCount}/${note.items.length} checked`
                  : `${doneCount}/${note.items.length} · Check all to re-check`}
            </span>

            <div className="flex items-center gap-2">
              <Link
                href={reviewHref}
                onClick={() => setExpanded(false)}
                className="twin-btn twin-btn-ghost text-[11px] py-1 px-2.5"
              >
                <span>Review &amp; Confirm</span>
              </Link>
              {renderActionButton()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      role="status"
      aria-label="Warning follow-up reminder"
      className={`twin-panel fixed bottom-4 left-4 z-40 w-[min(23rem,calc(100vw-2rem))] border-l-4 shadow-lg reminder-enter ${
        isExpired ? 'border-[var(--status-critical)]' : 'border-[var(--status-caution)]'
      }`}
    >
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StickyNote
                className={`h-3.5 w-3.5 shrink-0 ${
                  isExpired ? 'text-[var(--status-critical)]' : 'text-[var(--status-caution)]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isExpired ? 'text-[var(--status-critical)]' : 'text-[var(--status-caution)]'
                }`}
              >
                {isExpired ? 'Follow-Up Expired' : 'Follow-Up Post-it'}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-stem">
                {isExpired ? '00:00 · Due' : `${formatCountdown(remainingMs)} left`}
              </span>
            </div>

            <Link
              href={reviewHref}
              title="Open in Review & Confirm"
              className="mt-1 block text-xs font-semibold text-blueberry truncate hover:underline underline-offset-2"
            >
              {note.astronautName ? `${note.astronautName} · ${note.title}` : note.title}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand follow-up note as modal"
            title="Expand as modal"
            className="twin-btn twin-btn-ghost h-7 w-7 p-0 shrink-0"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {renderChecklist(false)}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-mono text-[10px] tabular-nums text-stem">
            {isExpired
              ? 'Expired — measure now'
              : allChecked
                ? `${doneCount}/${note.items.length} checked`
                : `${doneCount}/${note.items.length} · Check all to re-check`}
          </span>
          {renderActionButton()}
        </div>
      </div>
    </aside>
  );
}
