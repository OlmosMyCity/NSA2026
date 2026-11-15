/**
 * @module mocks/healthHistory
 * Deterministic 30-day synthetic telemetry generator used in mock mode (`ENV.USE_MOCKS`)
 * to populate historical trend charts and baseline readings per astronaut.
 */

import { mockDb } from '@/mocks/mockDb';
import type { ApiHealthReading } from '../domain/health/api-adapter';

const DAYS = 30;

/** Deterministic Park–Miller PRNG so mock charts remain identical across reloads. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Builds a 30-day synthetic reading history per astronaut anchored to their initial seed readings.
 */
export function buildMockHistory(astronautId: string): ApiHealthReading[] {
  const own = mockDb.readings
    .filter((r) => r.astronautId === astronautId && !r.deletedAt)
    .sort((x, y) => Date.parse(x.takenAt) - Date.parse(y.takenAt));
  // Anchor synthetic drift to the earliest seed reading; subsequent entries
  // (e.g., readings logged via the intake wizard) are appended verbatim at the end.
  const base = own[0];
  if (!base) return [];
  const rand = seeded(astronautId.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const jitter = (spread: number) => (rand() - 0.5) * 2 * spread;
  const now = Date.parse(base.takenAt);

  const history: ApiHealthReading[] = [];
  for (let day = DAYS - 1; day >= 1; day--) {
    // Earlier days drift toward healthier baselines so the final reading reflects real seed state.
    const drift = day / DAYS;
    history.push({
      id: `${base.id}-h${day}`,
      astronautId,
      heartRateBpm: round(base.heartRateBpm - drift * 12 + jitter(4)),
      systolicMmHg: round(base.systolicMmHg - drift * 10 + jitter(4)),
      diastolicMmHg: round(base.diastolicMmHg - drift * 6 + jitter(3)),
      glucoseMgDl: round(base.glucoseMgDl - drift * 30 + jitter(8)),
      temperatureC: round(base.temperatureC - drift * 0.8 + jitter(0.2), 1),
      spo2Pct: round(Math.min(100, base.spo2Pct + drift * 4 + jitter(1))),
      sleepHours: round(Math.max(3, base.sleepHours + drift * 1.5 + jitter(0.6)), 1),
      mood: Math.max(1, Math.min(5, round(base.mood + drift * 2 + jitter(0.6)))),
      resistanceExerciseMin: Math.max(0, round((75 - (1 - drift) * 40 + jitter(15)) / 5) * 5),
      status: 'OK',
      alerts: [],
      takenAt: new Date(now - day * 86400000).toISOString(),
    });
  }
  history.push({ ...base, resistanceExerciseMin: base.status === 'CRITICAL' ? 20 : 65 });
  for (const r of own.slice(1)) history.push({ ...r, alerts: r.alerts ?? [] });
  return history;
}
