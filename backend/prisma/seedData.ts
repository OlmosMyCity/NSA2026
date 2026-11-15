/**
 * Datos de prueba y estadísticas de OrbVital (NSA2026), generados en memoria.
 *
 * Este módulo es puro: no abre conexiones. Lo consumen
 *   - `prisma/seed.ts`                → escribe las filas con Prisma (`npx prisma db seed`)
 *   - `scripts/generateSeedSql.ts`    → genera `prisma/seed.sql` para el SQL Editor
 * así ambos caminos producen exactamente los mismos datos.
 *
 * - Misiones y astronautas astro-01…07 coinciden con el mock del frontend
 *   (`frontend/src/mocks/mockData.ts`) y con las trayectorias 3D
 *   (`frontend/src/domain/visualizer/trajectories.ts`): mission-01 = Apollo 11, etc.
 *   astro-08…15 completan las tripulaciones para tener series comparables.
 * - Lecturas, incidentes y directivas usan IDs `seed-…` para poder reemplazarlos
 *   sin tocar datos reales.
 * - PRNG con semilla fija: cada ejecución produce la misma historia, desplazada a `now`.
 * - El estado clínico de cada lectura sale de `evaluateReading`, la misma regla de la API,
 *   así que estadísticas, incidentes y gráficas son coherentes entre sí.
 */
import {
  Environment,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  MissionStatus,
  type Prisma,
} from "@prisma/client";
import {
  evaluateReading,
  type HealthEvaluationResult,
  type HealthReadingInput,
} from "../src/service/health/evaluateReading.js";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const MIN = 60_000;

export const SEED_USERS = {
  admin: {
    id: "user-admin-01",
    email: "elena.rodriguez@nasa.gov",
    name: "Dra. Elena Rodriguez",
    password: "HrpFlight#2026",
    role: "ADMIN" as const,
  },
  commander: {
    id: "user-crew-01",
    email: "r.wiseman@nasa.gov",
    name: "Reid Wiseman",
    password: "OrionCrew#4IV",
    role: "USER" as const,
  },
};

/** Astronauta ligado a la cuenta de tripulante de demo (dashboard de astro-01). */
export const COMMANDER_ASTRONAUT_ID = "astro-01";

// ---------------------------------------------------------------------------
// PRNG determinista (mulberry32) + ayudas
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Misiones y tripulación
// ---------------------------------------------------------------------------
type MissionKey = "APOLLO_11" | "ISS" | "APOLLO_13" | "APOLLO_17" | "ARTEMIS_II" | "APOLLO_8";

interface MissionDef {
  id: string;
  key: MissionKey;
  name: string;
  description: string;
  environment: Environment;
  /** Hace cuánto empezó la misión (ms), igual que en el mock del frontend. */
  startedAgo: number;
}

export const MISSIONS: MissionDef[] = [
  {
    id: "mission-01",
    key: "APOLLO_11",
    name: "Apollo 11 — First Lunar Landing",
    description:
      "8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.",
    environment: Environment.LUNAR_BASE,
    startedAgo: 4 * DAY,
  },
  {
    id: "mission-02",
    key: "ISS",
    name: "ISS Expedition 72 — Low Earth Orbit",
    description:
      "Crewed orbital science aboard the International Space Station at 415 km LEO, 51.64° inclination, and 7.66 km/s (~92.9 min orbital period) with Crew Dragon and Soyuz MS crew rotations.",
    environment: Environment.STATION,
    startedAgo: 3 * HOUR,
  },
  {
    id: "mission-03",
    key: "APOLLO_13",
    name: "Apollo 13 — Cislunar Free-Return Abort",
    description:
      "6-day crewed lunar free-return mission (April 11–17, 1970) with Jim Lovell, Jack Swigert, and Fred Haise rounding the lunar far side at 254 km pericynthion after the O2 tank #2 anomaly.",
    environment: Environment.SPACECRAFT,
    startedAgo: 3 * DAY,
  },
  {
    id: "mission-04",
    key: "APOLLO_17",
    name: "Apollo 17 — Taurus-Littrow Lunar Expedition",
    description:
      "12.6-day crewed lunar mission (Dec 7–19, 1972) with Gene Cernan, Harrison Schmitt, and Ron Evans conducting 22 h of Lunar Roving Vehicle EVA at Taurus-Littrow Valley.",
    environment: Environment.ROVER,
    startedAgo: 5 * DAY,
  },
  {
    id: "mission-05",
    key: "ARTEMIS_II",
    name: "Artemis II — Crewed Lunar Free-Return",
    description:
      "9-day crewed flight test aboard SLS Block 1 and Orion (Integrity) with Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen reaching 6,545 km above the lunar far side.",
    environment: Environment.SPACECRAFT,
    startedAgo: 4 * DAY,
  },
  {
    id: "mission-06",
    key: "APOLLO_8",
    name: "Apollo 8 — First Crewed Lunar Orbit",
    description:
      "6.1-day historic flight (Dec 21–27, 1968) with Frank Borman, Jim Lovell, and Bill Anders completing 10 lunar orbits at 111 km altitude aboard Saturn V SA-503.",
    environment: Environment.SPACECRAFT,
    startedAgo: 3 * DAY,
  },
];

/** Perfil fisiológico basal de cada tripulante (variación individual). */
interface CrewProfile {
  id: string;
  missionId: string;
  name: string;
  role: string;
  age: number;
  hr: number;
  sys: number;
  dia: number;
  glucose: number;
  sleep: number;
  mood: number;
}

export const CREW: CrewProfile[] = [
  // astro-01…07: idénticos al mock del frontend
  { id: "astro-01", missionId: "mission-01", name: "Cmdr. Elena Vance", role: "Mission Commander", age: 42, hr: 64, sys: 116, dia: 75, glucose: 93, sleep: 7.9, mood: 4.6 },
  { id: "astro-02", missionId: "mission-01", name: "Dr. Marcus Thorne", role: "Lunar Module Pilot", age: 39, hr: 61, sys: 120, dia: 77, glucose: 91, sleep: 8.0, mood: 4.7 },
  { id: "astro-03", missionId: "mission-02", name: "Maj. Kenji Takahashi", role: "Flight Engineer (ISS)", age: 44, hr: 63, sys: 117, dia: 74, glucose: 95, sleep: 8.0, mood: 4.7 },
  { id: "astro-04", missionId: "mission-03", name: "Capt. Sofia Navarro", role: "Command Module Pilot", age: 41, hr: 66, sys: 114, dia: 73, glucose: 92, sleep: 7.9, mood: 4.6 },
  { id: "astro-05", missionId: "mission-04", name: "Dr. Liam O'Connor", role: "Lunar Surface Geologist", age: 38, hr: 62, sys: 119, dia: 76, glucose: 90, sleep: 8.1, mood: 4.7 },
  { id: "astro-06", missionId: "mission-05", name: "Cmdr. Nadia Al-Mansoor", role: "Artemis Flight Specialist", age: 45, hr: 65, sys: 118, dia: 76, glucose: 96, sleep: 7.9, mood: 4.6 },
  { id: "astro-07", missionId: "mission-06", name: "Lt. Col. Mateo Silva", role: "Lunar Orbit Navigator", age: 43, hr: 67, sys: 121, dia: 78, glucose: 98, sleep: 7.8, mood: 4.6 },
  // astro-08…15: completan las tripulaciones
  { id: "astro-08", missionId: "mission-01", name: "Dr. Amara Okafor", role: "Command Module Pilot", age: 40, hr: 60, sys: 113, dia: 72, glucose: 89, sleep: 8.1, mood: 4.7 },
  { id: "astro-09", missionId: "mission-02", name: "Dr. Ingrid Halvorsen", role: "ISS Commander", age: 47, hr: 62, sys: 115, dia: 74, glucose: 94, sleep: 8.0, mood: 4.7 },
  { id: "astro-10", missionId: "mission-02", name: "Cmdr. Rafael Duarte", role: "Flight Engineer (Science)", age: 51, hr: 69, sys: 123, dia: 79, glucose: 102, sleep: 7.8, mood: 4.5 },
  { id: "astro-11", missionId: "mission-03", name: "Dr. Priya Raman", role: "Lunar Module Pilot", age: 37, hr: 63, sys: 112, dia: 71, glucose: 90, sleep: 8.1, mood: 4.7 },
  { id: "astro-12", missionId: "mission-04", name: "Cmdr. Tomás Ibarra", role: "Mission Commander", age: 46, hr: 65, sys: 121, dia: 78, glucose: 97, sleep: 7.8, mood: 4.6 },
  { id: "astro-13", missionId: "mission-05", name: "Dr. Hana Kobayashi", role: "Mission Specialist (Science)", age: 39, hr: 62, sys: 111, dia: 71, glucose: 88, sleep: 8.1, mood: 4.7 },
  { id: "astro-14", missionId: "mission-05", name: "Maj. Daniel Brooks", role: "Pilot", age: 42, hr: 64, sys: 122, dia: 78, glucose: 95, sleep: 7.9, mood: 4.6 },
  { id: "astro-15", missionId: "mission-06", name: "Dr. Yusuf Demir", role: "Command Module Pilot", age: 44, hr: 66, sys: 119, dia: 77, glucose: 96, sleep: 7.9, mood: 4.6 },
  // astro-16…19: 3+ tripulantes en todas las misiones (4 en Artemis II)
  { id: "astro-16", missionId: "mission-03", name: "Dr. Owen Callahan", role: "Mission Commander", age: 40, hr: 65, sys: 117, dia: 75, glucose: 94, sleep: 7.9, mood: 4.6 },
  { id: "astro-17", missionId: "mission-04", name: "Dr. Mei-Ling Zhou", role: "Command Module Pilot", age: 39, hr: 61, sys: 113, dia: 72, glucose: 91, sleep: 8.1, mood: 4.7 },
  { id: "astro-18", missionId: "mission-05", name: "Maj. Tomas Novak", role: "Mission Specialist (Systems)", age: 43, hr: 68, sys: 120, dia: 77, glucose: 98, sleep: 7.8, mood: 4.5 },
  { id: "astro-19", missionId: "mission-06", name: "Capt. Hannah Lindholm", role: "Lunar Module Pilot", age: 38, hr: 63, sys: 115, dia: 74, glucose: 92, sleep: 8.0, mood: 4.7 },
];

// ---------------------------------------------------------------------------
// Construcción del seed
// ---------------------------------------------------------------------------
type Phase = "PREFLIGHT" | "LAUNCH" | "INFLIGHT" | "ISS_INCREMENT";

interface PlannedReading {
  takenAt: Date;
  phase: Phase;
  input: HealthReadingInput;
  notes: string;
  /** Lectura errónea que luego se invalida y se corrige (modelo de solo agregado). */
  invalidate?: { reason: string; correction: Partial<HealthReadingInput>; correctionNotes: string };
}

export interface SeedIds {
  adminId: string;
  commanderUserId: string;
}

export interface SeedData {
  now: Date;
  missions: Prisma.MissionCreateManyInput[];
  astronauts: Prisma.AstronautCreateManyInput[];
  readings: Prisma.HealthReadingCreateManyInput[];
  incidents: Prisma.IncidentCreateManyInput[];
  directives: Prisma.DirectiveCreateManyInput[];
}

export function buildSeedData(ids: SeedIds, nowMs = Date.now()): SeedData {
  const rand = mulberry32(2026);
  const gauss = (sigma = 1) => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
  };
  const at = (msAgo: number) => new Date(nowMs - msAgo);
  const missionById = new Map(MISSIONS.map((m) => [m.id, m]));

  /** Lectura basal con ruido fisiológico; `drift` modula efectos de microgravedad (0–1). */
  function baseline(p: CrewProfile, drift = 0): HealthReadingInput {
    return {
      heartRateBpm: Math.round(clamp(p.hr - drift * 4 + gauss(3.5), 48, 120)),
      systolicMmHg: Math.round(clamp(p.sys - drift * 5 + gauss(3), 92, 150)),
      diastolicMmHg: Math.round(clamp(p.dia - drift * 2 + gauss(3), 58, 95)),
      glucoseMgDl: r1(clamp(p.glucose + drift * 8 + gauss(7), 72, 190)),
      temperatureC: r1(clamp(36.65 + drift * 0.15 + gauss(0.18), 35.8, 38.4)),
      spo2Pct: r1(clamp(97.8 + gauss(0.6), 95.2, 100)),
      sleepHours: r1(clamp(p.sleep - drift * 0.45 + gauss(0.3), 7.0, 9.2)),
      mood: Math.round(clamp(p.mood - drift * 0.35 + gauss(0.32), 4, 5)),
    };
  }

  // ---- Plan de lecturas -----------------------------------------------------
  /** Vuelo corto: 30 días de controles pre-vuelo, lanzamiento y chequeos cada `everyH` horas. */
  function planShortFlight(p: CrewProfile, everyH: number): PlannedReading[] {
    const m = missionById.get(p.missionId)!;
    const launch = nowMs - m.startedAgo;
    const out: PlannedReading[] = [];

    for (let d = 30; d >= 5; d--) {
      out.push({
        takenAt: new Date(launch - d * DAY + 7 * HOUR + gauss(0.4) * HOUR),
        phase: "PREFLIGHT",
        input: baseline(p),
        notes: `Pre-flight medical baseline (L-${d}). Flight medicine clinic.`,
      });
    }
    for (let d = 4; d >= 1; d--) {
      const input = baseline(p);
      input.sleepHours = r1(clamp(input.sleepHours - 0.4, 7, 9));
      out.push({
        takenAt: new Date(launch - d * DAY + 6 * HOUR),
        phase: "PREFLIGHT",
        input,
        notes: `Pre-launch health stabilization quarantine (L-${d}). Sleep shifting protocol.`,
      });
    }
    const launchInput = baseline(p);
    launchInput.heartRateBpm = Math.round(p.hr + 20 + gauss(3));
    launchInput.systolicMmHg = Math.round(p.sys + 8 + gauss(2));
    launchInput.glucoseMgDl = r1(p.glucose + 12 + gauss(4));
    out.push({
      takenAt: new Date(launch + 0.4 * HOUR),
      phase: "LAUNCH",
      input: launchInput,
      notes: "T+24m post-insertion check. Expected ascent tachycardia and pressor response.",
    });
    for (let h = everyH; launch + h * HOUR < nowMs - 1.5 * HOUR; h += everyH) {
      const drift = Math.min(1, 0.3 + (h / 72) * 0.7);
      out.push({
        takenAt: new Date(launch + h * HOUR + gauss(0.25) * HOUR),
        phase: "INFLIGHT",
        input: baseline(p, drift),
        notes: `T+${h}h scheduled biomedical check (MET ${Math.floor(h / 24)}d ${h % 24}h).`,
      });
    }
    out.push({
      takenAt: at(1 * HOUR + Math.abs(gauss(0.3)) * HOUR),
      phase: "INFLIGHT",
      input: baseline(p, 1),
      notes: "Latest in-flight reading relayed via Deep Space Network.",
    });
    return out;
  }

  /** Tripulación de la ISS: 90 días de incremento con un control diario (tendencias largas). */
  function planIssCrew(p: CrewProfile): PlannedReading[] {
    const out: PlannedReading[] = [];
    const days = 90;
    for (let d = days; d >= 1; d--) {
      const progress = 1 - d / days;
      const input = baseline(p, 0.3 + progress * 0.7);
      // "Efecto del tercer cuarto": ánimo y sueño decaen hacia el 60–80 % del incremento
      if (progress > 0.58 && progress < 0.8) {
        input.mood = Math.round(clamp(input.mood - 1 + gauss(0.25), 3, 5));
        input.sleepHours = r1(clamp(input.sleepHours - 0.5, 6.4, 9));
      }
      out.push({
        takenAt: new Date(nowMs - d * DAY + 8 * HOUR + gauss(0.5) * HOUR),
        phase: "ISS_INCREMENT",
        input,
        notes: `ISS daily health check, increment day ${days - d + 1}.`,
      });
    }
    // Dos chequeos recientes para que el dashboard tenga datos actuales
    for (const ago of [6 * HOUR, 1.5 * HOUR]) {
      out.push({
        takenAt: at(ago + Math.abs(gauss(0.2)) * HOUR),
        phase: "ISS_INCREMENT",
        input: baseline(p, 1),
        notes: "ISS orbit biomedical telemetry (Expedition 72).",
      });
    }
    return out;
  }

  const byCrew = new Map<string, PlannedReading[]>();
  for (const c of CREW) {
    const key = missionById.get(c.missionId)!.key;
    const plan =
      key === "ISS" ? planIssCrew(c) : planShortFlight(c, c.id === COMMANDER_ASTRONAUT_ID ? 4 : 8);
    byCrew.set(c.id, plan.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime()));
  }

  // ---- Eventos clínicos guionizados ----------------------------------------
  const list = (id: string) => byCrew.get(id) ?? [];
  const inflight = (id: string) => list(id).filter((r) => r.phase === "INFLIGHT");
  const fromEnd = (id: string, n: number) => list(id)[list(id).length - 1 - n];
  const edit = (r: PlannedReading | undefined, patch: Partial<HealthReadingInput>, notes: string) => {
    if (!r) return;
    Object.assign(r.input, patch);
    r.notes = notes;
  };
  const launchOf = (id: string) => list(id).find((r) => r.phase === "LAUNCH");

  // Apollo 11 — Comandante (demo): taquicardia de ascenso, EVA lunar y sueño corto posterior
  edit(launchOf("astro-01"), { heartRateBpm: 106 }, "Post-ascent tachycardia during TLI burn; resolved after 20 min of rest.");
  {
    const f = inflight("astro-01");
    edit(f[f.length - 4], { heartRateBpm: 97, glucoseMgDl: 74.5, temperatureC: 37.3 }, "Post-EVA surface check at Mare Tranquillitatis. Metabolic load elevated; hydrate 500 mL.");
    edit(f[f.length - 3], { sleepHours: 5.6, mood: 4 }, "Fragmented rest in LM Eagle cabin after EVA (noise, light, cold).");
    edit(f[f.length - 1], { sleepHours: 6.4, mood: 3 }, "Fatigue after lunar ascent and docking. Rest block scheduled.");
  }
  edit(inflight("astro-02")[5], { sleepHours: 6.3 }, "Short sleep: CSM Columbia waste-management fan noise.");
  edit(fromEnd("astro-08", 1), { systolicMmHg: 133, diastolicMmHg: 86 }, "Borderline BP during solo lunar-orbit operations in Columbia.");

  // ISS — tendencias de 90 días con eventos cerrados y uno reciente
  edit(fromEnd("astro-10", 41), { systolicMmHg: 146, diastolicMmHg: 92 }, "Elevated blood pressure after ARED session; repeat measurement normalized.");
  edit(fromEnd("astro-03", 14), { temperatureC: 37.8, heartRateBpm: 84 }, "Low-grade fever; viral panel negative. Rest day assigned.");
  edit(fromEnd("astro-03", 13), { temperatureC: 38.3, heartRateBpm: 92 }, "Fever peak; acetaminophen administered, isolation in crew quarters.");
  edit(fromEnd("astro-09", 3), { mood: 2, sleepHours: 5.8 }, "Third-quarter isolation effect: low mood and short sleep. Psychological support scheduled.");
  edit(fromEnd("astro-09", 1), { mood: 3, sleepHours: 6.6 }, "Improving after BHP conference; still below personal baseline.");
  edit(fromEnd("astro-10", 0), { glucoseMgDl: 152.4 }, "Post-prandial glucose elevated after high-carb resupply meal.");
  // Lectura errónea invalidada y corregida (oxímetro mal colocado)
  {
    const r = fromEnd("astro-03", 22);
    if (r) {
      r.input.spo2Pct = 86.2;
      r.notes = "Automatic pulse-oximeter capture during exercise.";
      r.invalidate = {
        reason: "Pulse oximeter displaced during ARED exercise (motion artifact).",
        correction: { spo2Pct: 97.6 },
        correctionNotes: "Repeat measurement at rest with finger probe re-seated.",
      };
    }
  }

  // Apollo 13 — anomalía del tanque de O2 (~T+56 h): frío, CO2, deshidratación y sin dormir
  for (const id of ["astro-04", "astro-11"]) {
    const m = missionById.get("mission-03")!;
    const anomaly = nowMs - m.startedAgo + 56 * HOUR;
    for (const r of inflight(id)) {
      const t = r.takenAt.getTime();
      if (t < anomaly) continue;
      const hoursSince = (t - anomaly) / HOUR;
      r.input.temperatureC = r1(clamp(36.4 - hoursSince * 0.04 + gauss(0.1), 35.6, 36.6));
      r.input.sleepHours = r1(clamp(4.6 + gauss(0.4), 3.5, 5.8));
      r.input.heartRateBpm = Math.round(clamp(r.input.heartRateBpm + 16 + gauss(3), 70, 104));
      r.input.spo2Pct = r1(clamp(94.4 - hoursSince * 0.06 + gauss(0.3), 92.4, 95));
      r.input.mood = Math.round(clamp(3 + gauss(0.4), 2, 4));
      r.notes = `T+${Math.round((t - (nowMs - m.startedAgo)) / HOUR)}h LM Aquarius lifeboat: cabin ~5 °C, rising CO2, water rationing.`;
    }
  }
  edit(fromEnd("astro-11", 0), { temperatureC: 35.4, glucoseMgDl: 68.2 }, "Hypothermia and low glucose: water and food rationing in powered-down LM. Urinary symptoms reported.");

  // Apollo 17 — dos EVA en rover y fiebre del heno por polvo lunar
  for (const id of ["astro-05", "astro-12"]) {
    const f = inflight(id);
    edit(f[f.length - 5], { heartRateBpm: 94, glucoseMgDl: 76.2, sleepHours: 6.5 }, "Post EVA-1: Lunar Roving Vehicle traverse to Steno crater.");
    edit(f[f.length - 2], { heartRateBpm: 99, glucoseMgDl: 79.4, sleepHours: 6.1 }, "Post EVA-2: 7 h 37 min geological traverse; electrolyte rehydration.");
  }
  edit(fromEnd("astro-05", 0), { temperatureC: 37.7, mood: 3 }, "Lunar dust 'hay fever': nasal congestion and watery eyes after cabin ingress.");

  // Artemis II — síndrome de adaptación espacial y CO2 en cabina
  for (const id of ["astro-06", "astro-13", "astro-14"]) {
    const f = inflight(id);
    edit(f[1], { sleepHours: 5.7, mood: 3 }, "Space adaptation syndrome: nausea and fragmented first night aboard Orion.");
    edit(f[2], { sleepHours: 6.4 }, "Adaptation improving; promethazine not required.");
  }
  edit(fromEnd("astro-14", 1), { spo2Pct: 93.6, mood: 3 }, "Reports mild headache after night shift; cabin CO2 scrubber inspected.");
  edit(fromEnd("astro-06", 0), { heartRateBpm: 47 }, "Resting bradycardia during sleep window; asymptomatic.");

  // Apollo 8 — mareo espacial del día 1 e inserción en órbita lunar
  {
    const f = inflight("astro-07");
    edit(f[0], { glucoseMgDl: 66.8, heartRateBpm: 92, sleepHours: 5.4, mood: 3 }, "Space motion sickness: vomiting and diarrhea after first sleep period. Hydration protocol.");
    edit(f[1], { glucoseMgDl: 78.1, sleepHours: 6.2 }, "Recovering from motion sickness; oral fluids tolerated.");
    edit(f[f.length - 2], { heartRateBpm: 93 }, "Lunar Orbit Insertion burn behind the Moon (LOS).");
  }
  {
    const r = inflight("astro-15")[4];
    if (r) {
      r.input.heartRateBpm = 138;
      r.notes = "Automatic biomedical harness capture.";
      r.invalidate = {
        reason: "ECG electrode detached; heart rate artifact.",
        correction: { heartRateBpm: 68 },
        correctionNotes: "Electrode re-applied; manual pulse confirmed.",
      };
    }
  }

  // ---- Filas: misiones y astronautas ---------------------------------------
  const missions: Prisma.MissionCreateManyInput[] = MISSIONS.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    environment: m.environment,
    status: MissionStatus.IN_PROGRESS,
    startDate: at(m.startedAgo),
    endDate: null,
    patchUrl: null,
    createdById: ids.adminId,
    createdAt: at(m.key === "ISS" ? 95 * DAY : 45 * DAY),
    updatedAt: at(0),
    deletedAt: null,
  }));

  const astronauts: Prisma.AstronautCreateManyInput[] = CREW.map((c) => ({
    id: c.id,
    missionId: c.missionId,
    userId: c.id === COMMANDER_ASTRONAUT_ID ? ids.commanderUserId : null,
    name: c.name,
    role: c.role,
    age: c.age,
    photoUrl: null,
    createdAt: at(40 * DAY),
    updatedAt: at(0),
    deletedAt: null,
  }));

  // ---- Filas: lecturas ------------------------------------------------------
  interface Evaluated {
    id: string;
    astronautId: string;
    missionId: string;
    takenAt: Date;
    evaluation: HealthEvaluationResult;
  }
  const evaluated: Evaluated[] = [];
  const readings: Prisma.HealthReadingCreateManyInput[] = [];
  const corrections: Prisma.HealthReadingCreateManyInput[] = [];

  const readingRow = (id: string, astronautId: string, input: HealthReadingInput, notes: string, takenAt: Date) => {
    const evaluation = evaluateReading(input);
    const row: Prisma.HealthReadingCreateManyInput = {
        id,
        astronautId,
        ...input,
        status: evaluation.status,
        alerts: evaluation.alerts as unknown as Prisma.InputJsonValue,
        recommendation: evaluation.recommendation,
        notes,
        takenAt,
        createdAt: takenAt,
        updatedAt: takenAt,
    };
    return { evaluation, row };
  };

  for (const c of CREW) {
    list(c.id).forEach((planned, i) => {
      const id = `seed-reading-${c.id}-${String(i).padStart(3, "0")}`;
      const { evaluation, row } = readingRow(id, c.id, planned.input, planned.notes, planned.takenAt);

      if (planned.invalidate) {
        const invalidatedAt = new Date(planned.takenAt.getTime() + 25 * MIN);
        Object.assign(row, {
          isValid: false,
          invalidatedAt,
          invalidatedReason: planned.invalidate.reason,
          invalidatedById: ids.adminId,
          updatedAt: invalidatedAt,
        });
        const fixedAt = new Date(planned.takenAt.getTime() + 20 * MIN);
        const fixed = readingRow(
          `seed-reading-${c.id}-${String(i).padStart(3, "0")}-fix`,
          c.id,
          { ...planned.input, ...planned.invalidate.correction },
          planned.invalidate.correctionNotes,
          fixedAt
        );
        fixed.row.supersedesId = id;
        corrections.push(fixed.row);
        // Solo la corrección cuenta para incidentes y estadísticas
        evaluated.push({ id: fixed.row.id!, astronautId: c.id, missionId: c.missionId, takenAt: fixedAt, evaluation: fixed.evaluation });
      } else {
        evaluated.push({ id, astronautId: c.id, missionId: c.missionId, takenAt: planned.takenAt, evaluation });
      }
      readings.push(row);
    });
  }
  // Las correcciones van después: su FK supersedesId apunta a una lectura ya insertada
  readings.push(...corrections);
  evaluated.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());

  // ---- Filas: incidentes ---------------------------------------------------
  // Por (astronauta, indicador) solo la alerta más reciente queda activa; las anteriores se cierran.
  const INDICATOR_LABELS: Record<string, string> = {
    heartRate: "Heart rate",
    bloodPressure: "Blood pressure",
    glucose: "Blood glucose",
    temperature: "Body temperature",
    spo2: "Oxygen saturation (SpO2)",
    sleep: "Sleep hours",
    mood: "Mood",
  };
  const incidents: Prisma.IncidentCreateManyInput[] = [];
  const latestActive = new Map<string, number>();
  let seq = 0;

  for (const e of evaluated) {
    for (const alert of e.evaluation.alerts) {
      const openedAt = new Date(e.takenAt.getTime() + 2 * MIN);
      const key = `${e.astronautId}|${alert.indicator}`;
      const prev = latestActive.get(key);
      if (prev !== undefined) {
        const p = incidents[prev];
        const pOpened = (p.openedAt as Date).getTime();
        Object.assign(p, {
          status: IncidentStatus.CLOSED,
          acknowledgedAt: new Date(pOpened + 15 * MIN),
          acknowledgedById: ids.adminId,
          closedAt: new Date(Math.max(pOpened + 20 * MIN, Math.min(openedAt.getTime() - MIN, pOpened + 6 * HOUR))),
          closedById: ids.adminId,
          resolutionNotes: "Repeat measurement within range after applying protocol.",
        });
      }
      incidents.push({
        id: `seed-incident-${String(++seq).padStart(4, "0")}`,
        category: IncidentCategory.MEDICAL,
        type: alert.indicator,
        severity: alert.level === "CRITICAL" ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING,
        status: IncidentStatus.OPEN,
        title: `Medical alert (${alert.level}): ${INDICATOR_LABELS[alert.indicator] ?? alert.indicator}`,
        description: alert.message,
        astronautId: e.astronautId,
        missionId: e.missionId,
        source: "HEALTH_READING",
        readingId: e.id,
        protocolId: alert.protocolId,
        metadata: { indicator: alert.indicator, protocolId: alert.protocolId, value: alert.value, readingStatus: e.evaluation.status, seed: true },
        openedAt,
        createdAt: openedAt,
        updatedAt: openedAt,
      });
      latestActive.set(key, incidents.length - 1);
    }
  }
  // Alertas activas: >3 días → cerradas; 12 h–3 días → reconocidas; recientes → abiertas
  for (const idx of latestActive.values()) {
    const row = incidents[idx];
    const opened = (row.openedAt as Date).getTime();
    const age = nowMs - opened;
    if (age > 3 * DAY) {
      Object.assign(row, {
        status: IncidentStatus.CLOSED,
        acknowledgedAt: new Date(opened + 25 * MIN),
        acknowledgedById: ids.adminId,
        closedAt: new Date(opened + 8 * HOUR),
        closedById: ids.adminId,
        resolutionNotes: "Resolved after protocol; follow-up readings nominal.",
      });
    } else if (age > 12 * HOUR) {
      Object.assign(row, {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(opened + 15 * MIN),
        acknowledgedById: ids.adminId,
      });
    }
  }
  for (const row of incidents) {
    row.updatedAt = (row.closedAt ?? row.acknowledgedAt ?? row.openedAt) as Date;
  }

  // Incidentes de radiación y de misión
  const m13 = missionById.get("mission-03")!;
  const m17 = missionById.get("mission-04")!;
  const extra: Prisma.IncidentCreateManyInput[] = [
    {
      id: "seed-incident-rad-01",
      category: IncidentCategory.RADIATION,
      type: "SOLAR_RADIATION_STORM",
      severity: IncidentSeverity.CRITICAL,
      status: IncidentStatus.CLOSED,
      title: "Solar radiation storm (S2_MODERATE)",
      description: "X1.8 flare from AR 3842 with fast CME. Crew sheltered in the Zvezda / US Lab shielded area. Abort EVA immediately.",
      missionId: "mission-02",
      source: "RADIATION_ENGINE",
      metadata: { stormScale: "S2_MODERATE", isSimulated: false, abortEvaImmediately: true, evacuateToStormShelter: true, powerDownExternalSensors: false, seed: true },
      openedAt: at(41 * DAY),
      acknowledgedAt: at(41 * DAY - 10 * MIN),
      acknowledgedById: ids.adminId,
      closedAt: at(40 * DAY),
      closedById: ids.adminId,
      resolutionNotes: "Proton flux >10 MeV back below S1 threshold after 21 h. Crew dose within limits.",
    },
    {
      id: "seed-incident-rad-02",
      category: IncidentCategory.RADIATION,
      type: "SOLAR_RADIATION_STORM",
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.CLOSED,
      title: "Solar radiation storm (S1_MINOR)",
      description: "M3.4 flare detected by GOES-18. Brief S1 proton event; external sensors kept powered.",
      missionId: "mission-02",
      source: "RADIATION_ENGINE",
      metadata: { stormScale: "S1_MINOR", isSimulated: false, abortEvaImmediately: false, evacuateToStormShelter: false, powerDownExternalSensors: false, seed: true },
      openedAt: at(68 * DAY),
      acknowledgedAt: at(68 * DAY - 12 * MIN),
      acknowledgedById: ids.adminId,
      closedAt: at(68 * DAY - 9 * HOUR),
      closedById: ids.adminId,
      resolutionNotes: "Event decayed below S1 after 9 h.",
    },
    {
      id: "seed-incident-rad-03",
      category: IncidentCategory.RADIATION,
      type: "SOLAR_RADIATION_STORM",
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.ACKNOWLEDGED,
      title: "Solar radiation storm (S1_MINOR)",
      description: "M5.2 flare detected by GOES-19. Proton arrival forecast in ~45 min. Orion crew to remain in cabin.",
      missionId: "mission-05",
      source: "RADIATION_ENGINE",
      metadata: { stormScale: "S1_MINOR", isSimulated: false, abortEvaImmediately: false, evacuateToStormShelter: false, powerDownExternalSensors: false, seed: true },
      openedAt: at(30 * HOUR),
      acknowledgedAt: at(30 * HOUR - 8 * MIN),
      acknowledgedById: ids.adminId,
    },
    {
      id: "seed-incident-rad-04",
      category: IncidentCategory.RADIATION,
      type: "SOLAR_RADIATION_STORM",
      severity: IncidentSeverity.CRITICAL,
      status: IncidentStatus.OPEN,
      title: "Solar radiation storm (S3_STRONG)",
      description: "X2.1 flare with SEP onset while LRV crew is on the lunar surface. Abort EVA-3 and return to LM Challenger.",
      missionId: "mission-04",
      source: "RADIATION_ENGINE",
      metadata: { stormScale: "S3_STRONG", isSimulated: true, abortEvaImmediately: true, evacuateToStormShelter: true, powerDownExternalSensors: true, seed: true },
      openedAt: at(45 * MIN),
    },
    {
      id: "seed-incident-mission-01",
      category: IncidentCategory.MISSION,
      type: "LIFE_SUPPORT_ANOMALY",
      severity: IncidentSeverity.CRITICAL,
      status: IncidentStatus.ACKNOWLEDGED,
      title: "O2 tank #2 rupture — Service Module power loss",
      description: "Loss of O2 tank #2 and fuel cells 1 and 3. Crew transferred to LM Aquarius as lifeboat; CO2 scrubber adapter (LiOH) required.",
      missionId: "mission-03",
      source: "MISSION_CONTROL",
      metadata: { subsystem: "EPS/ECLSS", lifeboat: "LM Aquarius", seed: true },
      openedAt: new Date(nowMs - m13.startedAgo + 56 * HOUR),
      acknowledgedAt: new Date(nowMs - m13.startedAgo + 56 * HOUR + 3 * MIN),
      acknowledgedById: ids.adminId,
    },
    {
      id: "seed-incident-mission-02",
      category: IncidentCategory.MISSION,
      type: "EVA_EQUIPMENT",
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.CLOSED,
      title: "LRV right-rear fender lost — dust exposure",
      description: "Fender extension broke off during EVA-1; crew covered in regolith. Improvised repair with maps and duct tape.",
      missionId: "mission-04",
      source: "MISSION_CONTROL",
      metadata: { subsystem: "LRV", seed: true },
      openedAt: new Date(nowMs - m17.startedAgo + 96 * HOUR),
      acknowledgedAt: new Date(nowMs - m17.startedAgo + 96 * HOUR + 10 * MIN),
      acknowledgedById: ids.adminId,
      closedAt: new Date(nowMs - m17.startedAgo + 106 * HOUR),
      closedById: ids.adminId,
      resolutionNotes: "Fender repaired before EVA-2.",
    },
  ];
  for (const row of extra) {
    row.createdAt = row.openedAt;
    row.updatedAt = (row.closedAt ?? row.acknowledgedAt ?? row.openedAt) as Date;
  }
  incidents.push(...extra);

  // ---- Filas: directivas ---------------------------------------------------
  const active = incidents.filter((r) => r.category === IncidentCategory.MEDICAL && r.status !== IncidentStatus.CLOSED);
  const directives: Prisma.DirectiveCreateManyInput[] = [
    ...active.map((r, i) => {
      const createdAt = new Date((r.openedAt as Date).getTime() + 10 * MIN);
      return {
        id: `seed-directive-${String(i + 1).padStart(3, "0")}`,
        astronautId: r.astronautId as string,
        issuedById: ids.adminId,
        incidentId: r.id,
        content: `Follow protocol ${r.protocolId}. Repeat the measurement in 2 hours and report symptoms.`,
        acknowledgedAt: r.status === IncidentStatus.ACKNOWLEDGED ? new Date((r.openedAt as Date).getTime() + 40 * MIN) : null,
        createdAt,
        updatedAt: createdAt,
      };
    }),
    { id: "seed-directive-crew-01", astronautId: "astro-01", issuedById: ids.adminId, content: "Hydration target 3.0 L/day during translunar coast. Log fluid intake each evening.", acknowledgedAt: at(2 * DAY), createdAt: at(3 * DAY), updatedAt: at(2 * DAY) },
    { id: "seed-directive-crew-02", astronautId: "astro-09", issuedById: ids.adminId, content: "Schedule a private psychological conference with the BHP team and protect an 8.5 h sleep window.", createdAt: at(60 * HOUR), updatedAt: at(60 * HOUR) },
    { id: "seed-directive-crew-03", astronautId: "astro-10", issuedById: ids.adminId, content: "Keep ARED loads at prescription and add a blood pressure check 15 min after each session.", acknowledgedAt: at(40 * DAY), createdAt: at(40 * DAY + 2 * HOUR), updatedAt: at(40 * DAY) },
    { id: "seed-directive-crew-04", astronautId: "astro-04", issuedById: ids.adminId, content: "Conserve water: 200 mL every 2 h. Wear lunar overshoes and stay in LM Aquarius; staggered 4 h rest rotation.", acknowledgedAt: at(10 * HOUR), createdAt: at(14 * HOUR), updatedAt: at(10 * HOUR) },
    { id: "seed-directive-crew-05", astronautId: "astro-11", issuedById: ids.adminId, content: "Report urinary symptoms and temperature every 4 h. Prioritize warm fluids when power allows.", createdAt: at(50 * MIN), updatedAt: at(50 * MIN) },
    { id: "seed-directive-crew-06", astronautId: "astro-12", issuedById: ids.adminId, content: "Abort EVA-3 and return to LM Challenger; log dosimeter readings at ingress.", createdAt: at(40 * MIN), updatedAt: at(40 * MIN) },
    { id: "seed-directive-crew-07", astronautId: "astro-07", issuedById: ids.adminId, content: "Antiemetic available in medical kit; oral rehydration 250 mL every hour until symptoms clear.", acknowledgedAt: at(2.5 * DAY), createdAt: at(2.6 * DAY), updatedAt: at(2.5 * DAY) },
  ];

  return { now: new Date(nowMs), missions, astronauts, readings, incidents, directives };
}

/** Resumen por clave (p. ej. status) para los logs del seed. */
export function countBy<T>(rows: T[], key: (r: T) => string) {
  const acc: Record<string, number> = {};
  for (const r of rows) acc[key(r)] = (acc[key(r)] ?? 0) + 1;
  return Object.entries(acc)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
