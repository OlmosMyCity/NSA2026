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
    name: 'Artemis IV — Lunar South Pole Expedition',
    description:
      'Long-duration crewed mission aboard SLS Block 1B + Orion, Gateway (NRHO) staging, and lunar south pole landing (86.8° S) for surface science and physiological monitoring.',
    environment: 'LUNAR_BASE',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 8 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-02',
    name: 'ISS Expedition 72 — Low Earth Orbit',
    description:
      'Crew Dragon / Falcon 9 orbital operations at 420 km LEO aboard the International Space Station for circadian alignment, fluid shift tracking, and resistive countermeasures.',
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
    name: 'Shackleton Base — Lunar Rover Traverse',
    description:
      'Starship HLS descent and pressurized rover EVA traverse along Shackleton Crater rim with real-time SpO2 and radiation shelter telemetry.',
    environment: 'ROVER',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-04',
    name: 'Ares I — Mars Transit & Deep Space Cruise',
    description:
      'Interplanetary transit trajectory toward Mars for deep-space GCR/SPE radiation countermeasures, autonomous biodosimetry, and crew behavioral health monitoring.',
    environment: 'MARS_BASE',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-05',
    name: 'Europa Clipper — Jupiter Outer-System Cruise',
    description:
      'Outer-system deep-space trajectory toward Jupiter and Europa evaluating high-energy GCR shielding and autonomous NHEJ DNA repair kinetics.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    patchUrl: null,
    createdById: 'user-admin-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mission-06',
    name: 'Vesper I — Venus Gravity-Assist Flyby',
    description:
      'Inner-system solar-flux flyby around Venus testing high-intensity SPE storm early warning, shelter protocols, and oral radioprotector schedules.',
    environment: 'SPACECRAFT',
    status: 'IN_PROGRESS',
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
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

