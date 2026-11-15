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
    name: 'Cmdr. Elena Vance',
    role: 'Mission Commander',
    age: 42,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-02',
    missionId: 'mission-01',
    userId: null,
    name: 'Dr. Marcus Thorne',
    role: 'Lunar Module Pilot',
    age: 39,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-03',
    missionId: 'mission-02',
    userId: null,
    name: 'Maj. Kenji Takahashi',
    role: 'Flight Engineer (ISS)',
    age: 44,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-04',
    missionId: 'mission-03',
    userId: null,
    name: 'Capt. Sofia Navarro',
    role: 'Command Module Pilot',
    age: 41,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-05',
    missionId: 'mission-04',
    userId: null,
    name: "Dr. Liam O'Connor",
    role: 'Lunar Surface Geologist',
    age: 38,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-06',
    missionId: 'mission-05',
    userId: null,
    name: 'Cmdr. Nadia Al-Mansoor',
    role: 'Artemis Flight Specialist',
    age: 45,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'astro-07',
    missionId: 'mission-06',
    userId: null,
    name: 'Lt. Col. Mateo Silva',
    role: 'Lunar Orbit Navigator',
    age: 43,
    photoUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
  status: 'OK' | 'WARNING' | 'CRITICAL';
  alerts: string[];
  rec: string;
  notes: string;
}

function buildScheduleReadings(
  astronautId: string,
  missionStartIso: string,
  points: SchedulePoint[],
  prefix: string,
): MockHealthReading[] {
  const startMs = Date.parse(missionStartIso);
  return points.map((p, idx) => {
    const takenAt = new Date(startMs + p.offsetHours * 3600000).toISOString();
    return {
      id: `${prefix}-${idx + 1}`,
      astronautId,
      heartRateBpm: p.hr,
      systolicMmHg: p.sbp,
      diastolicMmHg: p.dbp,
      glucoseMgDl: p.glu,
      temperatureC: p.temp,
      spo2Pct: p.spo2,
      sleepHours: p.sleep,
      mood: p.mood,
      status: p.status,
      alerts: p.alerts,
      recommendation: p.rec,
      notes: p.notes,
      takenAt,
      createdAt: takenAt,
      updatedAt: takenAt,
    };
  });
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
    status: 'OK',
    alerts: [],
    rec: 'Pre-launch 1-G baseline nominal.',
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
    status: 'OK',
    alerts: [],
    rec: 'Expected +Gx/+Gz ascent tachycardia and pressor response (NASA-STD-3001).',
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
    status: 'OK',
    alerts: [],
    rec: 'Nominal parking orbit transition.',
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
    status: 'OK',
    alerts: [],
    rec: 'Early cephalad fluid shift within expected 0-G adaptation.',
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
    status: 'OK',
    alerts: [],
    rec: 'Microgravity cardiovascular unloading nominal.',
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
    status: 'OK',
    alerts: [],
    rec: 'Continue ARED / resistive countermeasures and 2.5 L hydration.',
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
    status: 'OK',
    alerts: [],
    rec: 'Crew readiness nominal for lunar phase.',
    notes: 'T+72h pre-lunar approach telemetry.',
  },
];

const INITIAL_READINGS: MockHealthReading[] = [
  ...buildScheduleReadings('astro-01', INITIAL_MISSIONS[0].startDate, [
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
      status: 'OK',
      alerts: [],
      rec: 'Post-EVA metabolic elevation returning to baseline; hydrate 500 mL.',
      notes: 'T+96h post-lunar EVA surface check.',
    },
  ], 'm1-a1'),
  ...buildScheduleReadings('astro-02', INITIAL_MISSIONS[0].startDate, [
    STANDARD_CHECKLIST[0],
    STANDARD_CHECKLIST[3],
    STANDARD_CHECKLIST[5],
  ], 'm1-a2'),
  ...buildScheduleReadings('astro-03', INITIAL_MISSIONS[1].startDate, [
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
      status: 'OK',
      alerts: [],
      rec: 'Nominal ISS LEO microgravity baseline.',
      notes: 'Orbit 2 biomedical telemetry.',
    },
  ], 'm2-a3'),
  ...buildScheduleReadings('astro-04', INITIAL_MISSIONS[2].startDate, [
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
      status: 'WARNING',
      alerts: ['Mild hypothermia (35.7°C)', 'Severe sleep deficit (4.5 h)', 'Low mood / cold stress'],
      rec: 'Prioritize thermal layers, warm fluids, and staggered crew rest rotation.',
      notes: 'T+58h post-anomaly LM lifeboat power-down telemetry.',
    },
  ], 'm3-a4'),
  ...buildScheduleReadings('astro-05', INITIAL_MISSIONS[3].startDate, [
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
      status: 'WARNING',
      alerts: ['Post-EVA elevated HR (96 bpm)', 'Slightly reduced sleep (6.2 h)'],
      rec: 'Administer electrolyte rehydration and schedule 7h rest prior to EVA-2.',
      notes: 'T+110h Taurus-Littrow LRV geological traverse.',
    },
  ], 'm4-a5'),
  ...buildScheduleReadings('astro-06', INITIAL_MISSIONS[4].startDate, STANDARD_CHECKLIST, 'm5-a6'),
  ...buildScheduleReadings('astro-07', INITIAL_MISSIONS[5].startDate, STANDARD_CHECKLIST.slice(0, 6), 'm6-a7'),
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
      const storedMissions = localStorage.getItem('orbvital_mock_v3_missions');
      if (storedMissions) this.missions = JSON.parse(storedMissions);

      const storedAstronauts = localStorage.getItem('orbvital_mock_v3_astronauts');
      if (storedAstronauts) this.astronauts = JSON.parse(storedAstronauts);

      const storedReadings = localStorage.getItem('orbvital_mock_v3_readings');
      if (storedReadings) this.readings = JSON.parse(storedReadings);
    } catch {
      // Ignorar fallback
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('orbvital_mock_v3_missions', JSON.stringify(this.missions));
      localStorage.setItem('orbvital_mock_v3_astronauts', JSON.stringify(this.astronauts));
      localStorage.setItem('orbvital_mock_v3_readings', JSON.stringify(this.readings));
    } catch {
      // Ignorar fallback
    }
  }

  // Métodos de evaluación médica de acuerdo al NASA Space Apps Challenge
  evaluateReading(input: {
    heartRateBpm: number;
    systolicMmHg: number;
    diastolicMmHg: number;
    glucoseMgDl: number;
    temperatureC: number;
    spo2Pct: number;
    sleepHours: number;
    mood: number;
  }): { status: 'OK' | 'WARNING' | 'CRITICAL'; alerts: string[]; recommendation: string } {
    const alerts: string[] = [];
    let isCritical = false;
    let isWarning = false;

    // Heart rate
    if (input.heartRateBpm > 100 || input.heartRateBpm < 40) {
      alerts.push(`Critical heart rate: ${input.heartRateBpm} bpm (cardiovascular hazard)`);
      isCritical = true;
    } else if (
      (input.heartRateBpm >= 91 && input.heartRateBpm <= 100) ||
      (input.heartRateBpm >= 40 && input.heartRateBpm <= 49)
    ) {
      alerts.push(`Heart rate on watch: ${input.heartRateBpm} bpm`);
      isWarning = true;
    }

    // Blood pressure
    if (input.systolicMmHg >= 140 || input.diastolicMmHg >= 90 || input.systolicMmHg < 90) {
      alerts.push(`Blood pressure out of range: ${input.systolicMmHg}/${input.diastolicMmHg} mmHg`);
      isCritical = true;
    } else if (
      (input.systolicMmHg >= 130 && input.systolicMmHg <= 139) ||
      (input.diastolicMmHg >= 85 && input.diastolicMmHg <= 89)
    ) {
      alerts.push(`Borderline blood pressure: ${input.systolicMmHg}/${input.diastolicMmHg} mmHg`);
      isWarning = true;
    }

    // Glucose
    if (input.glucoseMgDl < 70 || input.glucoseMgDl > 180) {
      alerts.push(`Abnormal blood glucose: ${input.glucoseMgDl} mg/dL (nutritional risk)`);
      isCritical = true;
    } else if (input.glucoseMgDl > 140 && input.glucoseMgDl <= 180) {
      alerts.push(`Elevated postprandial glucose: ${input.glucoseMgDl} mg/dL`);
      isWarning = true;
    }

    // Temperature
    if (input.temperatureC > 38.0 || input.temperatureC < 35.5) {
      alerts.push(`Abnormal body temperature: ${input.temperatureC} °C (immune compromise)`);
      isCritical = true;
    } else if (input.temperatureC >= 37.6 && input.temperatureC <= 38.0) {
      alerts.push(`Low-grade space fever detected: ${input.temperatureC} °C`);
      isWarning = true;
    }

    // SpO2
    if (input.spo2Pct < 92) {
      alerts.push(`Critical SpO2 hypoxemia: ${input.spo2Pct}% (hostile closed environment)`);
      isCritical = true;
    } else if (input.spo2Pct >= 92 && input.spo2Pct < 95) {
      alerts.push(`Reduced SpO2 saturation: ${input.spo2Pct}%`);
      isWarning = true;
    }

    // Sleep duration
    if (input.sleepHours < 6) {
      alerts.push(`Sleep deprivation: ${input.sleepHours} h (circadian disruption)`);
      isCritical = true;
    } else if (input.sleepHours >= 6 && input.sleepHours < 7) {
      alerts.push(`Suboptimal sleep duration: ${input.sleepHours} h`);
      isWarning = true;
    }

    // Mood
    if (input.mood <= 2) {
      alerts.push(`Depressed mood index: level ${input.mood}/5 (isolation/confinement)`);
      isCritical = true;
    } else if (input.mood === 3) {
      alerts.push(`Moderate mood state: level 3/5`);
      isWarning = true;
    }

    const finalStatus: 'OK' | 'WARNING' | 'CRITICAL' = isCritical
      ? 'CRITICAL'
      : isWarning
      ? 'WARNING'
      : 'OK';

    let recommendation = 'Physiological indicators are stable. Proceed with nominal mission schedule.';
    if (finalStatus === 'CRITICAL') {
      recommendation =
        'MEDICAL WARNING: Notify the Flight Surgeon (Dr. Elena Rodriguez) immediately. Enforce cabin rest and cross-check life support systems.';
    } else if (finalStatus === 'WARNING') {
      recommendation =
        'Preventive medical watch: Increase hydration, rest for 30 minutes, and re-evaluate biometrics in 4 hours.';
    }

    return { status: finalStatus, alerts, recommendation };
  }

  save() {
    this.persist();
  }
}

export const mockDb = new MockDatabase();

