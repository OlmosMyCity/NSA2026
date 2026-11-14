/**
 * Base de datos simulada (Mock DB) sincronizada con el seed oficial de Artemis IV.
 * Se utiliza cuando NEXT_PUBLIC_USE_MOCKS=true para desarrollo desacoplado.
 */

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  passwordHash?: string;
  astronautId?: string;
}

export interface MockMission {
  id: string;
  name: string;
  description: string;
  environment: 'SPACECRAFT' | 'STATION' | 'ROVER' | 'LUNAR_BASE' | 'MARS_BASE';
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';
  startDate: string;
  endDate?: string | null;
  patchUrl?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  astronauts?: MockAstronaut[];
}

export interface MockAstronaut {
  id: string;
  missionId: string;
  userId?: string | null;
  name: string;
  role: string;
  age: number;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  mission?: { id: string; name: string };
}

export interface MockHealthReading {
  id: string;
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
  alerts: string[];
  recommendation?: string | null;
  notes?: string | null;
  takenAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    currentPage: number;
    limit: number;
    totalPages: number;
  };
}

// Datos iniciales idénticos al seed de Prisma
const INITIAL_USERS: MockUser[] = [
  {
    id: 'user-admin-01',
    email: 'elena.rodriguez@nasa.gov',
    name: 'Dra. Elena Rodriguez',
    role: 'ADMIN',
  },
  {
    id: 'user-crew-01',
    email: 'r.wiseman@nasa.gov',
    name: 'Reid Wiseman',
    role: 'USER',
    astronautId: 'astro-01',
  },
];

const INITIAL_MISSIONS: MockMission[] = [
  {
    id: 'mission-01',
    name: 'Apollo 11 — First Lunar Landing',
    description:
      '8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.',
    environment: 'LUNAR_BASE',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-02',
    name: 'ISS Expedition 72 — Low Earth Orbit',
    description:
      'Crewed orbital science aboard the International Space Station at 415 km LEO, 51.64° inclination, and 7.66 km/s (~92.9 min orbital period) with Crew Dragon and Soyuz MS crew rotations.',
    environment: 'STATION',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 3 * 3600000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-03',
    name: 'Apollo 13 — Cislunar Free-Return Abort',
    description:
      '6-day crewed lunar free-return mission (April 11–17, 1970) with Jim Lovell, Jack Swigert, and Fred Haise rounding the lunar far side at 254 km pericynthion after the O2 tank #2 anomaly.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-04',
    name: 'Apollo 17 — Taurus-Littrow Lunar Expedition',
    description:
      '12.6-day crewed lunar mission (Dec 7–19, 1972) with Gene Cernan, Harrison Schmitt, and Ron Evans conducting 22 h of Lunar Roving Vehicle EVA at Taurus-Littrow Valley.',
    environment: 'ROVER',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-05',
    name: 'Artemis II — Crewed Lunar Free-Return',
    description:
      '9-day crewed flight test aboard SLS Block 1 and Orion (Integrity) with Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen reaching 6,545 km above the lunar far side.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-06',
    name: 'Apollo 8 — First Crewed Lunar Orbit',
    description:
      '6.1-day historic flight (Dec 21–27, 1968) with Frank Borman, Jim Lovell, and Bill Anders completing 10 lunar orbits at 111 km altitude aboard Saturn V SA-503.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_ASTRONAUTS: MockAstronaut[] = [
  {
    id: 'astro-01',
    missionId: 'mission-01',
    userId: 'user-crew-01',
    name: 'Reid Wiseman',
    role: 'Mission Commander',
    age: 49,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-02',
    missionId: 'mission-01',
    userId: null,
    name: 'Victor Glover',
    role: 'Pilot',
    age: 48,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-03',
    missionId: 'mission-01',
    userId: null,
    name: 'Christina Koch',
    role: 'Mission Specialist (Science)',
    age: 46,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-04',
    missionId: 'mission-01',
    userId: null,
    name: 'Jeremy Hansen',
    role: 'Mission Specialist (Systems)',
    age: 50,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_READINGS: MockHealthReading[] = [
  {
    id: 'read-01',
    astronautId: 'astro-01',
    heartRateBpm: 68,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.5,
    mood: 5,
    status: 'OK',
    alerts: [],
    recommendation: 'Vital parameters within optimal mission range. Continue preventive routine.',
    notes: 'Morning post-cycle ergometer reading.',
    takenAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'read-02',
    astronautId: 'astro-02',
    heartRateBpm: 94,
    systolicMmHg: 134,
    diastolicMmHg: 86,
    glucoseMgDl: 145,
    temperatureC: 37.7,
    spo2Pct: 94,
    sleepHours: 6.2,
    mood: 3,
    status: 'WARNING',
    alerts: [
      'Elevated resting heart rate (94 bpm)',
      'Borderline blood pressure (134/86 mmHg)',
      'Slightly reduced SpO2 (94%)',
    ],
    recommendation:
      'Increase electrolyte hydration (0.5 L) and verify cabin O2 partial pressure.',
    notes: '4-hour lunar surface EVA completed.',
    takenAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'read-03',
    astronautId: 'astro-03',
    heartRateBpm: 104,
    systolicMmHg: 144,
    diastolicMmHg: 92,
    glucoseMgDl: 185,
    temperatureC: 38.3,
    spo2Pct: 91,
    sleepHours: 5.1,
    mood: 2,
    status: 'CRITICAL',
    alerts: [
      'Critical Alert: Tachycardia (>100 bpm)',
      'Stage 1 Hypertension (144/92 mmHg)',
      'Mild hypoxemia (<92% SpO2)',
      'Hyperthermia / space fever (38.3°C)',
    ],
    recommendation:
      'CRITICAL ALERT: Notify Flight Surgeon (Dr. Elena Rodriguez) immediately. Suspend EVA activity and administer antipyretic.',
    notes: 'Intense fatigue and headache following regolith sampling.',
    takenAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'read-04',
    astronautId: 'astro-04',
    heartRateBpm: 72,
    systolicMmHg: 120,
    diastolicMmHg: 78,
    glucoseMgDl: 110,
    temperatureC: 36.8,
    spo2Pct: 99,
    sleepHours: 8.0,
    mood: 4,
    status: 'OK',
    alerts: [],
    recommendation: 'Excellent physiological condition for Gateway module handover.',
    notes: 'Evening routine check.',
    takenAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper para persistir en memoria y opcionalmente en localStorage
class MockDatabase {
  users: MockUser[] = [...INITIAL_USERS];
  missions: MockMission[] = [...INITIAL_MISSIONS];
  astronauts: MockAstronaut[] = [...INITIAL_ASTRONAUTS];
  readings: MockHealthReading[] = [...INITIAL_READINGS];

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const storedMissions = localStorage.getItem('artemis_mock_missions');
      if (storedMissions) this.missions = JSON.parse(storedMissions);

      const storedAstronauts = localStorage.getItem('artemis_mock_astronauts');
      if (storedAstronauts) this.astronauts = JSON.parse(storedAstronauts);

      const storedReadings = localStorage.getItem('artemis_mock_readings');
      if (storedReadings) this.readings = JSON.parse(storedReadings);

      const storedUsers = localStorage.getItem('artemis_mock_users');
      if (storedUsers) this.users = JSON.parse(storedUsers);
    } catch {
      // Ignorar fallback
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('artemis_mock_missions', JSON.stringify(this.missions));
      localStorage.setItem('artemis_mock_astronauts', JSON.stringify(this.astronauts));
      localStorage.setItem('artemis_mock_readings', JSON.stringify(this.readings));
      localStorage.setItem('artemis_mock_users', JSON.stringify(this.users));
    } catch {
      // Ignorar fallback
    }
  }

  save() {
    this.persist();
  }
}

export const mockDb = new MockDatabase();

