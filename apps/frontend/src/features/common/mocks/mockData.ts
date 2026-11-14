/**
 * Datos semilla del backend simulado (NEXT_PUBLIC_USE_MOCKS=true), equivalentes a
 * apps/backend/prisma/seed.ts. Solo se carga mediante import dinámico desde httpClient,
 * así que no llega al bundle de producción.
 */
import { evaluateVitals } from '@/features/health/domain/evaluate';
import type { ApiHealthReading } from '@/features/health/domain/api-adapter';
import type { Vitals } from '@/features/health/domain/types';
import type { Mission } from '@/features/missions/domain/types';
import type { Astronaut } from '@/features/astronauts/domain/types';

/** Lectura tal como la devuelve el backend, con los campos de auditoría. */
export type MockReading = ApiHealthReading & { createdAt: string; updatedAt: string };

/** Directiva clínica (modelo Directive del backend). */
export interface MockDirective {
  id: string;
  astronautId: string;
  issuedById: string | null;
  incidentId: string | null;
  content: string;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  password: string;
}

export type MockAstronaut = Omit<Astronaut, 'mission'>;

export interface MockState {
  users: MockUser[];
  missions: Mission[];
  astronauts: MockAstronaut[];
  readings: MockReading[];
  directives: MockDirective[];
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const USERS: MockUser[] = [
  { id: 'user-admin-01', email: 'elena.rodriguez@nasa.gov', name: 'Dra. Elena Rodriguez', role: 'ADMIN', password: 'HrpFlight#2026' },
  { id: 'user-crew-01', email: 'r.wiseman@nasa.gov', name: 'Reid Wiseman', role: 'USER', password: 'OrionCrew#4IV' },
];

const mission = (m: Pick<Mission, 'id' | 'name' | 'description' | 'environment' | 'status'> & { start: number; created: number }): Mission => ({
  id: m.id,
  name: m.name,
  description: m.description,
  environment: m.environment,
  status: m.status,
  startDate: iso(m.start),
  endDate: null,
  patchUrl: null,
  createdById: 'user-admin-01',
  createdAt: iso(m.created),
  updatedAt: iso(0),
});

const MISSIONS: Mission[] = [
  mission({
    id: 'mission-01',
    name: 'Apollo 11 — First Lunar Landing',
    description:
      '8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.',
    environment: 'LUNAR_BASE',
    status: 'IN_PROGRESS',
    start: -4 * DAY,
    created: -30 * DAY,
  }),
  mission({
    id: 'mission-02',
    name: 'ISS Expedition 72 — Low Earth Orbit',
    description:
      'Crewed orbital science aboard the International Space Station at 415 km LEO, 51.64° inclination, and 7.66 km/s (~92.9 min orbital period) with Crew Dragon and Soyuz MS crew rotations.',
    environment: 'STATION',
    status: 'IN_PROGRESS',
    start: -3 * HOUR,
    created: -90 * DAY,
  }),
  mission({
    id: 'mission-03',
    name: 'Apollo 13 — Cislunar Free-Return Abort',
    description:
      '6-day crewed lunar free-return mission (April 11–17, 1970) with Jim Lovell, Jack Swigert, and Fred Haise rounding the lunar far side at 254 km pericynthion after the O2 tank #2 anomaly.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    start: -3 * DAY,
    created: 0,
  }),
  mission({
    id: 'mission-04',
    name: 'Apollo 17 — Taurus-Littrow Lunar Expedition',
    description:
      '12.6-day crewed lunar mission (Dec 7–19, 1972) with Gene Cernan, Harrison Schmitt, and Ron Evans conducting 22 h of Lunar Roving Vehicle EVA at Taurus-Littrow Valley.',
    environment: 'ROVER',
    status: 'IN_PROGRESS',
    start: -5 * DAY,
    created: 0,
  }),
  mission({
    id: 'mission-05',
    name: 'Artemis II — Crewed Lunar Free-Return',
    description:
      '9-day crewed flight test aboard SLS Block 1 and Orion (Integrity) with Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen reaching 6,545 km above the lunar far side.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    start: -4 * DAY,
    created: 0,
  }),
  mission({
    id: 'mission-06',
    name: 'Apollo 8 — First Crewed Lunar Orbit',
    description:
      '6.1-day historic flight (Dec 21–27, 1968) with Frank Borman, Jim Lovell, and Bill Anders completing 10 lunar orbits at 111 km altitude aboard Saturn V SA-503.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    start: -3 * DAY,
    created: 0,
  }),
];

const astronaut = (id: string, name: string, role: string, age: number, userId: string | null = null): MockAstronaut => ({
  id,
  missionId: 'mission-01',
  userId,
  name,
  role,
  age,
  photoUrl: null,
  createdAt: iso(-20 * DAY),
  updatedAt: iso(0),
});

const ASTRONAUTS: MockAstronaut[] = [
  astronaut('astro-01', 'Reid Wiseman', 'Mission Commander', 49, 'user-crew-01'),
  astronaut('astro-02', 'Victor Glover', 'Pilot', 48),
  astronaut('astro-03', 'Christina Koch', 'Mission Specialist (Science)', 46),
  astronaut('astro-04', 'Jeremy Hansen', 'Mission Specialist (Systems)', 50),
];

/** Última lectura de cada astronauta; el historial de 30 días se deriva de ella. */
const LATEST: Array<{ astronautId: string; ageMs: number; notes: string; vitals: Vitals }> = [
  {
    astronautId: 'astro-01',
    ageMs: 2 * HOUR,
    notes: 'Morning post-cycle ergometer reading.',
    vitals: { heartRateBpm: 68, systolicMmHg: 118, diastolicMmHg: 76, glucoseMgDl: 95, temperatureC: 36.6, spo2Pct: 98, sleepHours: 7.5, mood: 5 },
  },
  {
    astronautId: 'astro-02',
    ageMs: 6 * HOUR,
    notes: '4-hour lunar surface EVA completed.',
    vitals: { heartRateBpm: 94, systolicMmHg: 134, diastolicMmHg: 86, glucoseMgDl: 145, temperatureC: 37.7, spo2Pct: 94, sleepHours: 6.2, mood: 3 },
  },
  {
    astronautId: 'astro-03',
    ageMs: 1 * HOUR,
    notes: 'Intense fatigue and headache following regolith sampling.',
    vitals: { heartRateBpm: 104, systolicMmHg: 144, diastolicMmHg: 92, glucoseMgDl: 185, temperatureC: 38.3, spo2Pct: 91, sleepHours: 5.1, mood: 2 },
  },
  {
    astronautId: 'astro-04',
    ageMs: 12 * HOUR,
    notes: 'Evening routine check.',
    vitals: { heartRateBpm: 72, systolicMmHg: 120, diastolicMmHg: 78, glucoseMgDl: 110, temperatureC: 36.8, spo2Pct: 99, sleepHours: 8.0, mood: 4 },
  },
];

/** Pseudoaleatorio determinista: mismas gráficas en cada recarga. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

export function buildReading(id: string, astronautId: string, vitals: Vitals, takenAt: string, notes: string | null = null): MockReading {
  const evaluation = evaluateVitals(vitals);
  return { id, astronautId, ...vitals, ...evaluation, notes, takenAt, createdAt: takenAt, updatedAt: takenAt };
}

/** 29 días sintéticos (los antiguos tienden a valores más sanos) + la lectura real. */
function history({ astronautId, ageMs, notes, vitals: base }: (typeof LATEST)[number]): MockReading[] {
  const rand = seeded(astronautId.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const jitter = (spread: number) => (rand() - 0.5) * 2 * spread;
  const latestAt = Date.now() - ageMs;
  const rows: MockReading[] = [];
  for (let day = 29; day >= 1; day--) {
    const drift = day / 30;
    rows.push(
      buildReading(
        `read-${astronautId}-d${day}`,
        astronautId,
        {
          heartRateBpm: round(base.heartRateBpm - drift * 12 + jitter(4)),
          systolicMmHg: round(base.systolicMmHg - drift * 10 + jitter(4)),
          diastolicMmHg: round(base.diastolicMmHg - drift * 6 + jitter(3)),
          glucoseMgDl: round(base.glucoseMgDl - drift * 30 + jitter(8)),
          temperatureC: round(base.temperatureC - drift * 0.8 + jitter(0.2), 1),
          spo2Pct: round(Math.min(100, base.spo2Pct + drift * 4 + jitter(1))),
          sleepHours: round(Math.max(3, base.sleepHours + drift * 1.5 + jitter(0.6)), 1),
          mood: Math.max(1, Math.min(5, round(base.mood + drift * 2 + jitter(0.6)))),
        },
        new Date(latestAt - day * DAY).toISOString(),
      ),
    );
  }
  rows.push(buildReading(`read-${astronautId}-latest`, astronautId, base, new Date(latestAt).toISOString(), notes));
  return rows;
}

export function seedState(): MockState {
  return {
    users: USERS.map((u) => ({ ...u })),
    missions: MISSIONS.map((m) => ({ ...m })),
    astronauts: ASTRONAUTS.map((a) => ({ ...a })),
    readings: LATEST.flatMap(history),
    directives: [],
  };
}
