/**
 * Datos semilla del backend simulado (NEXT_PUBLIC_USE_MOCKS=true), equivalentes a
 * backend/prisma/seed.ts. Solo se carga mediante import dinámico desde httpClient,
 * así que no llega al bundle de producción.
 */
import { evaluateVitals } from '@/domain/health/evaluate';
import type { ApiHealthReading } from '@/domain/health/api-adapter';
import type { Vitals } from '@/domain/health/types';
import type { Mission } from '@/domain/missions/types';
import type { Astronaut, FaceBiometricSample } from '@/domain/astronauts/types';

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
  role: 'ADMIN' | 'USER' | 'OPERATOR';
  password: string;
}

/** Misión con el operador de tierra asignado (Mission.operatorId en el backend). */
export type MockMission = Mission & { operatorId?: string | null };

/** Astronauta con su ubicación, que el backend solo expone por la ruta autenticada /astronauts/:id/location. */
export type MockAstronaut = Omit<Astronaut, 'mission'> & { currentLocation?: string | null; locationUpdatedAt?: string | null };

export interface MockState {
  users: MockUser[];
  missions: MockMission[];
  astronauts: MockAstronaut[];
  readings: MockReading[];
  directives: MockDirective[];
  faceSamples: FaceBiometricSample[];
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const USERS: MockUser[] = [
  { id: 'user-admin-01', email: 'elena.rodriguez@nasa.gov', name: 'Dra. Elena Rodriguez', role: 'ADMIN', password: 'HrpFlight#2026' },
  { id: 'user-crew-01', email: 'r.wiseman@nasa.gov', name: 'Reid Wiseman', role: 'USER', password: 'OrionCrew#4IV' },
  { id: 'user-operator-01', email: 'ops@orbvital.example', name: 'Mission Operations', role: 'OPERATOR', password: 'GroundOps#2026' },
];

const mission = (m: Pick<MockMission, 'id' | 'name' | 'description' | 'environment' | 'status' | 'operatorId'> & { start: number; created: number }): MockMission => ({
  id: m.id,
  name: m.name,
  description: m.description,
  environment: m.environment,
  status: m.status,
  startDate: iso(m.start),
  endDate: null,
  patchUrl: null,
  createdById: 'user-admin-01',
  operatorId: m.operatorId ?? null,
  createdAt: iso(m.created),
  updatedAt: iso(0),
});

const MISSIONS: MockMission[] = [
  mission({
    id: 'mission-01',
    name: 'Apollo 11 — First Lunar Landing',
    description:
      '8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.',
    environment: 'LUNAR_BASE',
    status: 'IN_PROGRESS',
    operatorId: 'user-operator-01',
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

const astronaut = (id: string, missionId: string, name: string, role: string, age: number, userId: string | null = null): MockAstronaut => ({
  id,
  missionId,
  userId,
  name,
  role,
  age,
  photoUrl: null,
  createdAt: iso(-20 * DAY),
  updatedAt: iso(0),
});

const ASTRONAUTS: MockAstronaut[] = [
  // Mission 01: Apollo 11
  astronaut('astro-01', 'mission-01', 'Cmdr. Elena Vance', 'Mission Commander', 42, 'user-crew-01'),
  astronaut('astro-02', 'mission-01', 'Dr. Marcus Thorne', 'Lunar Module Pilot', 39),
  astronaut('astro-08', 'mission-01', 'Dr. Amara Okafor', 'Command Module Pilot', 40),
  // Mission 02: ISS Expedition 72
  astronaut('astro-03', 'mission-02', 'Maj. Kenji Takahashi', 'Flight Engineer (ISS)', 44),
  astronaut('astro-09', 'mission-02', 'Dr. Ingrid Halvorsen', 'ISS Commander', 47),
  astronaut('astro-10', 'mission-02', 'Cmdr. Rafael Duarte', 'Flight Engineer (Science)', 51),
  // Mission 03: Apollo 13
  astronaut('astro-04', 'mission-03', 'Capt. Sofia Navarro', 'Command Module Pilot', 41),
  astronaut('astro-11', 'mission-03', 'Dr. Priya Raman', 'Lunar Module Pilot', 37),
  astronaut('astro-16', 'mission-03', 'Dr. Owen Callahan', 'Mission Commander', 40),
  // Mission 04: Apollo 17
  astronaut('astro-05', 'mission-04', "Dr. Liam O'Connor", 'Lunar Surface Geologist', 38),
  astronaut('astro-12', 'mission-04', 'Cmdr. Tomás Ibarra', 'Mission Commander', 46),
  astronaut('astro-17', 'mission-04', 'Dr. Mei-Ling Zhou', 'Command Module Pilot', 39),
  // Mission 05: Artemis II
  astronaut('astro-06', 'mission-05', 'Cmdr. Nadia Al-Mansoor', 'Artemis Flight Specialist', 45),
  astronaut('astro-13', 'mission-05', 'Dr. Hana Kobayashi', 'Mission Specialist (Science)', 39),
  astronaut('astro-14', 'mission-05', 'Maj. Daniel Brooks', 'Pilot', 42),
  astronaut('astro-18', 'mission-05', 'Maj. Tomas Novak', 'Mission Specialist (Systems)', 43),
  // Mission 06: Apollo 8
  astronaut('astro-07', 'mission-06', 'Lt. Col. Mateo Silva', 'Lunar Orbit Navigator', 43),
  astronaut('astro-15', 'mission-06', 'Dr. Yusuf Demir', 'Command Module Pilot', 44),
  astronaut('astro-19', 'mission-06', 'Capt. Hannah Lindholm', 'Lunar Module Pilot', 38),
];

export function buildReading(id: string, astronautId: string, vitals: Vitals, takenAt: string, notes: string | null = null): MockReading {
  const evaluation = evaluateVitals(vitals);
  return { id, astronautId, ...vitals, ...evaluation, notes, takenAt, createdAt: takenAt, updatedAt: takenAt };
}

/** Punto del calendario de controles de una misión (horas desde el inicio de la misión). */
interface SchedulePoint {
  offsetHours: number;
  hr: number;
  sbp: number;
  dbp: number;
  glu: number;
  temp: number;
  spo2: number;
  sleep: number;
  mood: number;
  notes: string;
}

/** Lecturas de un astronauta según el calendario de su misión; el estado lo calcula la tabla clínica común. */
function buildScheduleReadings(astronautId: string, missionStartIso: string, points: SchedulePoint[], prefix: string): MockReading[] {
  const startMs = Date.parse(missionStartIso);
  return points.map((p, idx) =>
    buildReading(
      `${prefix}-${idx + 1}`,
      astronautId,
      {
        heartRateBpm: p.hr,
        systolicMmHg: p.sbp,
        diastolicMmHg: p.dbp,
        glucoseMgDl: p.glu,
        temperatureC: p.temp,
        spo2Pct: p.spo2,
        sleepHours: p.sleep,
        mood: p.mood,
      },
      new Date(startMs + p.offsetHours * HOUR).toISOString(),
      p.notes,
    ),
  );
}

const STANDARD_CHECKLIST: SchedulePoint[] = [
  {
    offsetHours: -2,
    hr: 66,
    sbp: 118,
    dbp: 76,
    glu: 94,
    temp: 36.6,
    spo2: 99,
    sleep: 7.8,
    mood: 5,
    notes: 'L-2h suit-up biomedical check.',
  },
  {
    offsetHours: 0.4,
    hr: 112,
    sbp: 142,
    dbp: 86,
    glu: 108,
    temp: 36.8,
    spo2: 97,
    sleep: 7.5,
    mood: 4,
    notes: 'T+24m post-MECO / orbital insertion telemetry.',
  },
  {
    offsetHours: 2.5,
    hr: 74,
    sbp: 120,
    dbp: 78,
    glu: 98,
    temp: 36.7,
    spo2: 98,
    sleep: 7.5,
    mood: 5,
    notes: 'T+2h30m pre-TLI systems & medical check.',
  },
  {
    offsetHours: 12,
    hr: 64,
    sbp: 114,
    dbp: 74,
    glu: 96,
    temp: 36.5,
    spo2: 98,
    sleep: 6.8,
    mood: 4,
    notes: 'T+12h scheduled 12-hour biomedical log.',
  },
  {
    offsetHours: 24,
    hr: 61,
    sbp: 112,
    dbp: 72,
    glu: 92,
    temp: 36.5,
    spo2: 98,
    sleep: 6.6,
    mood: 4,
    notes: 'T+24h daily medical & cognitive check-in.',
  },
  {
    offsetHours: 48,
    hr: 62,
    sbp: 113,
    dbp: 73,
    glu: 95,
    temp: 36.6,
    spo2: 98,
    sleep: 6.9,
    mood: 5,
    notes: 'T+48h routine 24h biomedical check.',
  },
  {
    offsetHours: 72,
    hr: 65,
    sbp: 116,
    dbp: 75,
    glu: 101,
    temp: 36.6,
    spo2: 97,
    sleep: 6.7,
    mood: 4,
    notes: 'T+72h pre-lunar approach telemetry.',
  },
];

const SCHEDULED_READINGS: MockReading[] = [
  ...buildScheduleReadings('astro-01', MISSIONS[0].startDate, [
    ...STANDARD_CHECKLIST,
    {
      offsetHours: 96,
      hr: 91,
      sbp: 132,
      dbp: 84,
      glu: 116,
      temp: 37.1,
      spo2: 96,
      sleep: 6.4,
      mood: 5,
      notes: 'T+96h post-lunar EVA surface check.',
    },
  ], 'm1-a1'),
  ...buildScheduleReadings('astro-02', MISSIONS[0].startDate, [
    STANDARD_CHECKLIST[0],
    STANDARD_CHECKLIST[3],
    STANDARD_CHECKLIST[5],
  ], 'm1-a2'),
  ...buildScheduleReadings('astro-03', MISSIONS[1].startDate, [
    STANDARD_CHECKLIST[0],
    STANDARD_CHECKLIST[1],
    {
      offsetHours: 2.0,
      hr: 63,
      sbp: 114,
      dbp: 74,
      glu: 93,
      temp: 36.5,
      spo2: 98,
      sleep: 6.8,
      mood: 4,
      notes: 'Orbit 2 biomedical telemetry.',
    },
  ], 'm2-a3'),
  ...buildScheduleReadings('astro-04', MISSIONS[2].startDate, [
    STANDARD_CHECKLIST[0],
    STANDARD_CHECKLIST[1],
    STANDARD_CHECKLIST[3],
    {
      offsetHours: 58,
      hr: 86,
      sbp: 128,
      dbp: 82,
      glu: 88,
      temp: 35.7,
      spo2: 95,
      sleep: 4.5,
      mood: 2,
      notes: 'T+58h post-anomaly LM lifeboat power-down telemetry.',
    },
  ], 'm3-a4'),
  ...buildScheduleReadings('astro-05', MISSIONS[3].startDate, [
    ...STANDARD_CHECKLIST,
    {
      offsetHours: 110,
      hr: 96,
      sbp: 136,
      dbp: 86,
      glu: 122,
      temp: 37.2,
      spo2: 95,
      sleep: 6.2,
      mood: 4,
      notes: 'T+110h Taurus-Littrow LRV geological traverse.',
    },
  ], 'm4-a5'),
  ...buildScheduleReadings('astro-06', MISSIONS[4].startDate, STANDARD_CHECKLIST, 'm5-a6'),
  ...buildScheduleReadings('astro-07', MISSIONS[5].startDate, STANDARD_CHECKLIST.slice(0, 6), 'm6-a7'),
  // Additional distinct crew readings across all 6 missions
  ...buildScheduleReadings('astro-08', MISSIONS[0].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[4]], 'm1-a8'),
  ...buildScheduleReadings('astro-09', MISSIONS[1].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[5]], 'm2-a9'),
  ...buildScheduleReadings('astro-10', MISSIONS[1].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[3], STANDARD_CHECKLIST[4]], 'm2-a10'),
  ...buildScheduleReadings('astro-11', MISSIONS[2].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[5]], 'm3-a11'),
  ...buildScheduleReadings('astro-12', MISSIONS[3].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[3], STANDARD_CHECKLIST[4]], 'm4-a12'),
  ...buildScheduleReadings('astro-13', MISSIONS[4].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[4]], 'm5-a13'),
  ...buildScheduleReadings('astro-14', MISSIONS[4].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[3], STANDARD_CHECKLIST[5]], 'm5-a14'),
  ...buildScheduleReadings('astro-15', MISSIONS[5].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[4]], 'm6-a15'),
  ...buildScheduleReadings('astro-16', MISSIONS[2].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[1], STANDARD_CHECKLIST[4]], 'm3-a16'),
  ...buildScheduleReadings('astro-17', MISSIONS[3].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[2], STANDARD_CHECKLIST[5]], 'm4-a17'),
  ...buildScheduleReadings('astro-18', MISSIONS[4].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[1], STANDARD_CHECKLIST[4]], 'm5-a18'),
  ...buildScheduleReadings('astro-19', MISSIONS[5].startDate, [STANDARD_CHECKLIST[0], STANDARD_CHECKLIST[3], STANDARD_CHECKLIST[5]], 'm6-a19'),
];

export function seedState(): MockState {
  return {
    users: USERS.map((u) => ({ ...u })),
    missions: MISSIONS.map((m) => ({ ...m })),
    astronauts: ASTRONAUTS.map((a) => ({ ...a })),
    readings: SCHEDULED_READINGS.map((r) => ({ ...r })),
    directives: [],
    faceSamples: [],
  };
}
