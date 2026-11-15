'use client';

/**
 * @module components/common/OnboardingModal
 * Authenticated workspace orientation dialog persisted per user role in `localStorage`.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const ONBOARDING_STORAGE_KEY = 'orbvital:onboarding-dismissed:v1';
export const OPEN_ONBOARDING_EVENT = 'artemis:open-onboarding';

interface WorkspaceGuideItem {
  href: string;
  title: string;
  summary: string;
}

const CREW_WORKSPACES: WorkspaceGuideItem[] = [
  {
    href: '/dashboard',
    title: 'My Health',
    summary: 'Inspect 3D body status, simulate countermeasures & review vital trends.',
  },
  {
    href: '/readings/new',
    title: 'Log Reading',
    summary: 'Record vitals manually or capture a contactless optical scan.',
  },
  {
    href: '/routine',
    title: 'Daily Routine',
    summary: 'Execute prioritized HRP protocols, nutrition & circadian tasks.',
  },
  {
    href: '/visualizer',
    title: 'Missions & Orbit',
    summary: 'Track 3D NRHO trajectory, active crew & facial biometrics.',
  },
];

const OPERATOR_WORKSPACES: WorkspaceGuideItem[] = [
  {
    href: '/operator',
    title: 'Oversight',
    summary: 'Monitor crew readiness, vitals freshness & habitat locations.',
  },
  {
    href: '/missions',
    title: 'Missions',
    summary: 'Inspect active crewed missions and habitat parameters.',
  },
  {
    href: '/visualizer',
    title: '3D Orbit',
    summary: 'Track live cislunar NRHO trajectory and solar radiation.',
  },
];

/** Role-aware workspace guide modal shown only to authenticated users. */
export function OnboardingModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!userId || !userRole) {
      setIsOpen(false);
      return;
    }

    try {
      const dismissedKey = `${ONBOARDING_STORAGE_KEY}:${userRole}`;
      const sessionKey = `orbvital:onboarding-shown-session:${userId}`;
      const isDismissed = localStorage.getItem(dismissedKey) === 'true';
      const shownInSession = sessionStorage.getItem(sessionKey) === 'true';

      if (!isDismissed && !shownInSession) {
        sessionStorage.setItem(sessionKey, 'true');
        setDontShowAgain(true);
        setIsOpen(true);
      }
    } catch {
      // Ignore storage access failures in restricted browser contexts.
    }
  }, [userId, userRole]);

  useEffect(() => {
    const handleOpen = () => {
      if (!userRole) return;
      try {
        const isDismissed = localStorage.getItem(`${ONBOARDING_STORAGE_KEY}:${userRole}`) === 'true';
        setDontShowAgain(isDismissed);
      } catch {
        setDontShowAgain(true);
      }
      setIsOpen(true);
    };

    window.addEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, handleOpen);
  }, [userRole]);

  const handleClose = useCallback(() => {
    if (userRole) {
      try {
        const dismissedKey = `${ONBOARDING_STORAGE_KEY}:${userRole}`;
        if (dontShowAgain) {
          localStorage.setItem(dismissedKey, 'true');
        } else {
          localStorage.removeItem(dismissedKey);
        }
      } catch {
        // Ignore storage write errors.
      }
    }
    setIsOpen(false);
  }, [dontShowAgain, userRole]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!user || !isOpen) return null;

  const items = user.role === 'OPERATOR' ? OPERATOR_WORKSPACES : CREW_WORKSPACES;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/75 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="surface-elevated relative w-full max-w-lg animate-materialize overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2
              id="onboarding-title"
              className="font-display text-lg font-bold tracking-tight text-blueberry"
            >
              Workspace Guide
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stem">
              Quick overview of your available operational sections. Select any module to open it directly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close workspace guide"
            className="tactile-press rounded-md p-1.5 text-stem hover:bg-surface-tinted hover:text-blueberry"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Available workspaces" className="divide-y divide-line">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClose}
              className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-tinted/50"
            >
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-plate group-hover:text-yogurt">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-stem">{item.summary}</p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-stem transition-transform group-hover:translate-x-0.5 group-hover:text-plate"
                aria-hidden="true"
              />
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface-subtle/60 px-6 py-4">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs text-stem hover:text-blueberry">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line bg-surface accent-plate"
            />
            <span>Don&apos;t show this guide again</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="tactile-press rounded-sm bg-plate px-4 py-2 text-xs font-semibold text-ink-inverse hover:bg-yogurt"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
