/**
 * @module domain/health/followUpStorage
 * Lightweight browser persistence for WARNING-level follow-up "Post-it" reminders,
 * bounded to the 15-minute `LIVE_VITALS_WINDOW_MS` measurement validity window.
 */

import { LIVE_VITALS_WINDOW_MS } from './freshness';

export interface FollowUpChecklistItem {
  id: string;
  text: string;
  howTo?: string;
  done: boolean;
}

export interface FollowUpStickyRecord {
  astronautId: string;
  astronautName?: string;
  title: string;
  createdAt: number;
  expiresAt: number;
  items: FollowUpChecklistItem[];
}

const KEY_PREFIX = 'orbvital.followup.';
const LATEST_KEY = 'orbvital.followup.latestAstronautId';
export const FOLLOWUP_CHANGE_EVENT = 'orbvital:followup-change';

function keyFor(astronautId: string): string {
  return `${KEY_PREFIX}${astronautId}`;
}

function notifyChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOLLOWUP_CHANGE_EVENT));
  }
}

export function saveFollowUpNote(input: {
  astronautId: string;
  astronautName?: string;
  title: string;
  items: Array<{ id: string; text: string; howTo?: string; done?: boolean }>;
  nowMs?: number;
}): void {
  if (typeof window === 'undefined' || !input.astronautId) return;
  const now = input.nowMs ?? Date.now();
  const record: FollowUpStickyRecord = {
    astronautId: input.astronautId,
    astronautName: input.astronautName,
    title: input.title,
    createdAt: now,
    expiresAt: now + LIVE_VITALS_WINDOW_MS,
    items: input.items.map((item) => ({
      id: item.id,
      text: item.text,
      howTo: item.howTo,
      done: Boolean(item.done),
    })),
  };
  try {
    window.localStorage.setItem(keyFor(input.astronautId), JSON.stringify(record));
    window.localStorage.setItem(LATEST_KEY, input.astronautId);
    notifyChange();
  } catch {
    // Ignore quota/private-mode storage errors without blocking telemetry save.
  }
}

export function loadActiveFollowUpNote(astronautId: string): FollowUpStickyRecord | null {
  if (typeof window === 'undefined' || !astronautId) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(astronautId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FollowUpStickyRecord;
    if (!parsed || typeof parsed.expiresAt !== 'number' || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadLatestActiveFollowUpNote(
  preferredAstronautId?: string,
): FollowUpStickyRecord | null {
  if (typeof window === 'undefined') return null;
  if (preferredAstronautId) {
    const own = loadActiveFollowUpNote(preferredAstronautId);
    if (own) return own;
  }
  try {
    const latestId = window.localStorage.getItem(LATEST_KEY);
    if (!latestId) return null;
    const found = loadActiveFollowUpNote(latestId);
    if (!found) {
      window.localStorage.removeItem(LATEST_KEY);
    }
    return found;
  } catch {
    return null;
  }
}

export function setFollowUpItemDone(
  astronautId: string,
  itemId: string,
  done: boolean,
): FollowUpStickyRecord | null {
  const current = loadActiveFollowUpNote(astronautId);
  if (!current || typeof window === 'undefined') return null;
  const hasItem = current.items.some((it) => it.id === itemId);
  if (!hasItem) return current;
  const updated: FollowUpStickyRecord = {
    ...current,
    items: current.items.map((it) => (it.id === itemId ? { ...it, done } : it)),
  };
  try {
    window.localStorage.setItem(keyFor(astronautId), JSON.stringify(updated));
    notifyChange();
  } catch {
    // Ignore storage failures.
  }
  return updated;
}

export function toggleFollowUpItem(astronautId: string, itemId: string): FollowUpStickyRecord | null {
  const current = loadActiveFollowUpNote(astronautId);
  if (!current || typeof window === 'undefined') return null;
  const target = current.items.find((it) => it.id === itemId);
  if (!target) return current;
  return setFollowUpItemDone(astronautId, itemId, !target.done);
}

export function clearFollowUpNote(astronautId: string): void {
  if (typeof window === 'undefined' || !astronautId) return;
  try {
    window.localStorage.removeItem(keyFor(astronautId));
    if (window.localStorage.getItem(LATEST_KEY) === astronautId) {
      window.localStorage.removeItem(LATEST_KEY);
    }
    notifyChange();
  } catch {
    // Ignore storage failures.
  }
}

