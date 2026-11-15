/**
 * Seed de datos de prueba y estadísticas para OrbVital (NSA2026).
 *
 * Uso:
 *   npx prisma db seed            → reemplaza solo los datos que crea este seed
 *   npx prisma db seed -- --reset → borra TODA la base y la vuelve a sembrar
 *
 * - Los IDs de usuarios, misiones y astronautas coinciden con el mock del frontend
 *   (`frontend/src/mocks/mockDb.ts`): astro-01, mission-01…
 *   Así el dashboard de demo (astro-01) y las trayectorias 3D (mission-01) encuentran sus datos.
 * - Lecturas, incidentes y directivas usan IDs con prefijo `seed-` para poder
 *   reemplazarlos sin tocar datos reales (p. ej. lecturas que llegan de Vision AI).
 * - Los valores se generan con un PRNG con semilla fija: cada ejecución produce
 *   la misma historia, solo desplazada a la fecha actual.
 * - El estado clínico de cada lectura se calcula con `evaluateReading`, la misma
 *   regla que usa la API, así que estadísticas e incidentes son coherentes.
 */
import {
  PrismaClient,
  Role,
  Environment,
  MissionStatus,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  type Prisma,
} from "@prisma/client";
import bcrypt from "bcrypt";
import {
  evaluateReading,
  type HealthEvaluationResult,
  type HealthReadingInput,
} from "../src/service/health/evaluateReading.js";

const prisma = new PrismaClient();
const RESET = process.argv.includes("--reset") || process.env.SEED_RESET === "true";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const at = (msAgo: number) => new Date(NOW - msAgo);

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
const rand = mulberry32(2026);

/**
 * health_readings es solo de agregado (P1): un trigger bloquea DELETE.
 * El seed es la única excepción y lo declara explícitamente dentro de su transacción.
 * También elimina las correcciones encadenadas a sus lecturas (supersedesId),
 * que son datos de demo aunque las haya creado alguien desde la API.
 */
async function purgeHealthReadings(scope: "seed" | "all") {
  const chain =
    scope === "all"
      ? `SELECT id FROM health_readings`
      : `WITH RECURSIVE chain AS (
           SELECT id FROM health_readings WHERE id LIKE 'seed-%'
           UNION
           SELECT h.id FROM health_readings h JOIN chain c ON h."supersedesId" = c.id
         ) SELECT id FROM chain`;
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL orbvital.allow_health_purge = 'on'`),
    prisma.$executeRawUnsafe(`UPDATE health_readings SET "supersedesId" = NULL WHERE id IN (${chain}) AND "supersedesId" IS NOT NULL`),
    prisma.$executeRawUnsafe(`DELETE FROM health_readings WHERE id IN (${chain})`),
  ]);
}
const gauss = (sigma = 1) => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Datos base (idénticos al mock del frontend)
// ---------------------------------------------------------------------------
const MISSIONS = [
  {
    id: "mission-01",
    name: "Apollo 11 — First Lunar Landing",
    description:
      "8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.",
    environment: Environment.LUNAR_BASE,
    startDate: at(4 * DAY),
  },
  {
    id: "mission-02",
    name: "ISS Expedition 72 — Low Earth Orbit",
    description:
      "Crewed orbital science aboard the International Space Station at 415 km LEO, 51.64° inclination, and 7.66 km/s (~92.9 min orbital period) with Crew Dragon and Soyuz MS crew rotations.",
    environment: Environment.STATION,
    startDate: at(3 * HOUR),
  },
  {
    id: "mission-03",
    name: "Apollo 13 — Cislunar Free-Return Abort",
    description:
      "6-day crewed lunar free-return mission (April 11–17, 1970) with Jim Lovell, Jack Swigert, and Fred Haise rounding the lunar far side at 254 km pericynthion after the O2 tank #2 anomaly.",
    environment: Environment.SPACECRAFT,
    startDate: at(5 * HOUR),
  },
  {
    id: "mission-04",
    name: "Apollo 17 — Taurus-Littrow Lunar Expedition",
    description:
      "12.6-day crewed lunar mission (Dec 7–19, 1972) with Gene Cernan, Harrison Schmitt, and Ron Evans conducting 22 h of Lunar Roving Vehicle EVA at Taurus-Littrow Valley.",
    environment: Environment.ROVER,
    startDate: at(4 * DAY),
  },
  {
    id: "mission-05",
    name: "Artemis II — Crewed Lunar Free-Return",
    description:
      "9-day crewed flight test aboard SLS Block 1 and Orion (Integrity) with Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen reaching 6,545 km above the lunar far side.",
    environment: Environment.SPACECRAFT,
    startDate: at(5 * DAY),
  },
  {
    id: "mission-06",
    name: "Apollo 8 — First Crewed Lunar Orbit",
    description:
      "6.1-day historic flight (Dec 21–27, 1968) with Frank Borman, Jim Lovell, and Bill Anders completing 10 lunar orbits at 111 km altitude aboard Saturn V SA-503.",
    environment: Environment.SPACECRAFT,
    startDate: at(2 * DAY),
  },
];

/** Perfil fisiológico basal de cada tripulante (variación individual). */
interface CrewProfile {
  id: string;
  missionId: string;
  name: string;
  role: string;
  age: number;
  linkCommanderUser?: boolean;
  hr: number;
  sys: number;
  dia: number;
  glucose: number;
  sleep: number;
  mood: number;
}

const CREW: CrewProfile[] = [
  { id: "astro-01", missionId: "mission-01", name: "Cmdr. Elena Vance", role: "Mission Commander", age: 42, linkCommanderUser: true, hr: 66, sys: 118, dia: 76, glucose: 96, sleep: 7.9, mood: 4.6 },
  { id: "astro-02", missionId: "mission-01", name: "Dr. Marcus Thorne", role: "Lunar Module Pilot", age: 39, hr: 62, sys: 121, dia: 78, glucose: 92, sleep: 8.0, mood: 4.7 },
  { id: "astro-03", missionId: "mission-02", name: "Maj. Kenji Takahashi", role: "Flight Engineer (ISS)", age: 44, hr: 64, sys: 112, dia: 72, glucose: 90, sleep: 8.1, mood: 4.7 },
  { id: "astro-04", missionId: "mission-03", name: "Capt. Sofia Navarro", role: "Command Module Pilot", age: 37, hr: 70, sys: 121, dia: 78, glucose: 101, sleep: 7.8, mood: 4.5 },
  { id: "astro-05", missionId: "mission-04", name: "Dr. Liam O'Connor", role: "Lunar Surface Geologist", age: 41, hr: 63, sys: 116, dia: 74, glucose: 94, sleep: 8.0, mood: 4.7 },
  { id: "astro-06", missionId: "mission-05", name: "Cmdr. Nadia Al-Mansoor", role: "Artemis Flight Specialist", age: 40, hr: 67, sys: 122, dia: 79, glucose: 99, sleep: 7.9, mood: 4.6 },
  { id: "astro-07", missionId: "mission-06", name: "Lt. Col. Mateo Silva", role: "Lunar Orbit Navigator", age: 45, hr: 69, sys: 122, dia: 78, glucose: 103, sleep: 7.8, mood: 4.6 },
];

// ---------------------------------------------------------------------------
// Generación de lecturas
// ---------------------------------------------------------------------------
type Phase = "PREFLIGHT" | "LAUNCH" | "INFLIGHT" | "ISS_INCREMENT";

interface PlannedReading {
  takenAt: Date;
  phase: Phase;
  input: HealthReadingInput;
  notes: string;
}

/** Lectura basal con ruido fisiológico; `drift` modula efectos de microgravedad (0–1). */
function baseline(p: CrewProfile, drift = 0): HealthReadingInput {
  return {
    heartRateBpm: Math.round(clamp(p.hr - drift * 4 + gauss(3.5), 48, 120)),
    systolicMmHg: Math.round(clamp(p.sys - drift * 5 + gauss(3), 92, 150)),
    diastolicMmHg: Math.round(clamp(p.dia - drift * 2 + gauss(3), 58, 95)),
    glucoseMgDl: r1(clamp(p.glucose + drift * 8 + gauss(7), 72, 190)),
    temperatureC: r1(clamp(36.65 + drift * 0.15 + gauss(0.18), 35.8, 38.4)),
    spo2Pct: r1(clamp(97.8 + gauss(0.6), 93.5, 100)),
    sleepHours: r1(clamp(p.sleep - drift * 0.45 + gauss(0.3), 4.2, 9.2)),
    mood: Math.round(clamp(p.mood - drift * 0.35 + gauss(0.32), 1, 5)),
  };
}

function planArtemisCrew(p: CrewProfile): PlannedReading[] {
  const out: PlannedReading[] = [];
  const launch = NOW - 4 * DAY;

  // Pre-vuelo: control médico diario durante 56 días (L-60 → L-5)
  for (let d = 60; d >= 5; d--) {
    const takenAt = new Date(launch - d * DAY + 7 * HOUR + gauss(0.4) * HOUR);
    out.push({
      takenAt,
      phase: "PREFLIGHT",
      input: baseline(p),
      notes: `Pre-flight medical baseline (L-${d}). Johnson Space Center flight medicine clinic.`,
    });
  }
  // Cuarentena previa al lanzamiento (L-4 → L-1): sueño desplazado
  for (let d = 4; d >= 1; d--) {
    const input = baseline(p);
    input.sleepHours = r1(clamp(input.sleepHours - 0.5, 4.5, 9));
    out.push({
      takenAt: new Date(launch - d * DAY + 6 * HOUR),
      phase: "PREFLIGHT",
      input,
      notes: `Pre-launch health stabilization quarantine (L-${d}). Sleep shifting protocol.`,
    });
  }
  // Día de lanzamiento: estrés de ascenso
  const launchInput = baseline(p);
  launchInput.heartRateBpm = Math.round(p.hr + 22 + gauss(5));
  launchInput.systolicMmHg = Math.round(p.sys + 10 + gauss(3));
  launchInput.sleepHours = r1(clamp(p.sleep - 2.2 + gauss(0.3), 4, 7));
  out.push({
    takenAt: new Date(launch + 2 * HOUR),
    phase: "LAUNCH",
    input: launchInput,
    notes: "Post-insertion check after SLS ascent and TLI burn. Elevated sympathetic tone expected.",
  });
  // En vuelo: 3 lecturas por día (mañana / tarde / pre-sueño) durante 4 días
  for (let day = 0; day < 4; day++) {
    for (const [h, label] of [
      [9, "Morning"],
      [15, "Afternoon"],
      [21, "Pre-sleep"],
    ] as const) {
      const ts = launch + day * DAY + h * HOUR + gauss(0.3) * HOUR;
      if (ts > NOW - 1.5 * HOUR) continue;
      const input = baseline(p, Math.min(1, 0.4 + day * 0.15));
      // Adaptación al espacio: primeras noches con menos sueño
      if (day <= 1) input.sleepHours = r1(clamp(input.sleepHours - 1.1, 4.3, 8));
      out.push({
        takenAt: new Date(ts),
        phase: "INFLIGHT",
        input,
        notes: `${label} Orion cabin check, flight day ${day + 1}.`,
      });
    }
  }
  // Lectura más reciente (hace ~2 h) para que el dashboard muestre datos actuales
  out.push({
    takenAt: at(2 * HOUR),
    phase: "INFLIGHT",
    input: baseline(p, 0.9),
    notes: "Latest in-flight reading relayed via Deep Space Network.",
  });
  return out;
}

function planIssCrew(p: CrewProfile): PlannedReading[] {
  const out: PlannedReading[] = [];
  const days = 90;
  for (let d = days; d >= 0; d--) {
    const progress = 1 - d / days; // 0 → 1 a lo largo del incremento
    const input = baseline(p, 0.3 + progress * 0.7);
    // "Efecto del tercer cuarto": bajón de ánimo hacia el 60–80 % de la misión
    if (progress > 0.58 && progress < 0.8) input.mood = Math.round(clamp(input.mood - 1 + gauss(0.3), 1, 5));
    const ts = d === 0 ? NOW - 3 * HOUR : NOW - d * DAY + 8 * HOUR + gauss(0.5) * HOUR;
    out.push({
      takenAt: new Date(ts),
      phase: "ISS_INCREMENT",
      input,
      notes: `ISS daily health check, increment day ${days - d + 1}.`,
    });
  }
  return out;
}

/** Eventos clínicos guionizados que generan alertas e incidentes reales. */
function applyScriptedEvents(byCrew: Map<string, PlannedReading[]>) {
  const tweak = (id: string, pick: (r: PlannedReading[]) => PlannedReading | undefined, fn: (r: PlannedReading) => void) => {
    const list = byCrew.get(id);
    const target = list && pick(list);
    if (target) fn(target);
  };
  const lastOfPhase = (phase: Phase) => (l: PlannedReading[]) => [...l].reverse().find((r) => r.phase === phase);
  const nthFromEnd = (n: number) => (l: PlannedReading[]) => l[l.length - 1 - n];

  // Artemis II — Comandante: taquicardia en el ascenso (CRITICAL)
  tweak("astro-01", (l) => l.find((r) => r.phase === "LAUNCH"), (r) => {
    r.input.heartRateBpm = 108;
    r.notes = "Post-ascent tachycardia during TLI burn; resolved after 20 min of rest.";
  });
  // Artemis II — Piloto: cefalea y SpO2 limítrofe por CO2 en cabina (WARNING, aún abierto)
  tweak("astro-02", nthFromEnd(1), (r) => {
    r.input.spo2Pct = 93.6;
    r.input.mood = 3;
    r.notes = "Reports mild headache after night shift; cabin CO2 scrubber inspected.";
  });
  // Artemis II — Especialista de sistemas: mal sueño las primeras noches (WARNING)
  tweak("astro-04", lastOfPhase("INFLIGHT"), (r) => {
    r.input.sleepHours = 5.4;
    r.notes = "Space adaptation syndrome: fragmented sleep, mild nausea. Promethazine considered.";
  });
  // ISS — Pettit: crisis hipertensiva hace 40 días (cerrada)
  tweak("astro-07", nthFromEnd(40), (r) => {
    r.input.systolicMmHg = 146;
    r.input.diastolicMmHg = 92;
    r.notes = "Elevated blood pressure after ARED session; repeat measurement normalized.";
  });
  // ISS — Wilmore: febrícula hace 12 días (cerrada)
  tweak("astro-06", nthFromEnd(12), (r) => {
    r.input.temperatureC = 37.8;
    r.notes = "Low-grade fever; viral panel negative. Rest day assigned.";
  });
  // ISS — Williams: ánimo bajo reciente (WARNING, reconocido)
  tweak("astro-05", nthFromEnd(2), (r) => {
    r.input.mood = 2;
    r.input.sleepHours = 5.8;
    r.notes = "Third-quarter isolation effect: low mood and short sleep. Psychological support scheduled.";
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`🌱 OrbVital seed${RESET ? " (--reset: borrado total)" : ""}`);

  if (RESET) {
    await prisma.directive.deleteMany();
    await prisma.incident.deleteMany();
    await purgeHealthReadings("all");
    await prisma.astronaut.deleteMany();
    await prisma.mission.deleteMany();
    await prisma.user.deleteMany();
  } else {
    // Reemplazar solo lo que crea este seed
    await prisma.directive.deleteMany({ where: { id: { startsWith: "seed-" } } });
    await prisma.incident.deleteMany({ where: { id: { startsWith: "seed-" } } });
    await purgeHealthReadings("seed");
  }

  // 1. Usuarios (upsert por email para respetar cuentas existentes)
  const [adminHash, crewHash] = await Promise.all([
    bcrypt.hash("HrpFlight#2026", 10),
    bcrypt.hash("OrionCrew#4IV", 10),
  ]);
  const admin = await prisma.user.upsert({
    where: { email: "elena.rodriguez@nasa.gov" },
    update: { name: "Dra. Elena Rodriguez", role: Role.ADMIN, passwordHash: adminHash, deletedAt: null },
    create: { id: "user-admin-01", email: "elena.rodriguez@nasa.gov", name: "Dra. Elena Rodriguez", passwordHash: adminHash, role: Role.ADMIN },
  });
  const commander = await prisma.user.upsert({
    where: { email: "r.wiseman@nasa.gov" },
    update: { name: "Reid Wiseman", role: Role.USER, passwordHash: crewHash, deletedAt: null },
    create: { id: "user-crew-01", email: "r.wiseman@nasa.gov", name: "Reid Wiseman", passwordHash: crewHash, role: Role.USER },
  });
  console.log("✅ Usuarios: admin (Flight Surgeon) y comandante.");

  // 2. Misiones
  for (const m of MISSIONS) {
    const data = {
      name: m.name,
      description: m.description,
      environment: m.environment,
      status: MissionStatus.IN_PROGRESS,
      startDate: m.startDate,
      deletedAt: null,
    };
    await prisma.mission.upsert({
      where: { id: m.id },
      update: data,
      create: { id: m.id, ...data, createdById: admin.id },
    });
  }
  console.log(`✅ ${MISSIONS.length} misiones.`);

  // 3. Tripulación (el usuario comandante se desvincula de cualquier astronauta previo)
  await prisma.astronaut.updateMany({
    where: { userId: commander.id, NOT: { id: "astro-01" } },
    data: { userId: null },
  });
  for (const c of CREW) {
    const data = {
      missionId: c.missionId,
      name: c.name,
      role: c.role,
      age: c.age,
      userId: c.linkCommanderUser ? commander.id : null,
      deletedAt: null,
    };
    await prisma.astronaut.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } });
  }
  console.log(`✅ ${CREW.length} astronautas.`);

  // 4. Lecturas
  const byCrew = new Map<string, PlannedReading[]>();
  for (const c of CREW) {
    byCrew.set(c.id, c.missionId === "mission-02" ? planIssCrew(c) : planArtemisCrew(c));
  }
  applyScriptedEvents(byCrew);

  interface Evaluated {
    id: string;
    astronautId: string;
    missionId: string;
    planned: PlannedReading;
    evaluation: HealthEvaluationResult;
  }
  const evaluated: Evaluated[] = [];
  const readingRows: Prisma.HealthReadingCreateManyInput[] = [];

  for (const c of CREW) {
    const list = (byCrew.get(c.id) ?? []).sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
    list.forEach((planned, i) => {
      const id = `seed-reading-${c.id}-${String(i).padStart(3, "0")}`;
      const evaluation = evaluateReading(planned.input);
      evaluated.push({ id, astronautId: c.id, missionId: c.missionId, planned, evaluation });
      readingRows.push({
        id,
        astronautId: c.id,
        ...planned.input,
        status: evaluation.status,
        alerts: evaluation.alerts as unknown as Prisma.InputJsonValue,
        recommendation: evaluation.recommendation,
        notes: planned.notes,
        takenAt: planned.takenAt,
        createdAt: planned.takenAt,
      });
    });
  }
  await prisma.healthReading.createMany({ data: readingRows });

  const byStatus = readingRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status as string] = (acc[r.status as string] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✅ ${readingRows.length} lecturas (${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ")}).`);

  // 5. Incidentes médicos derivados de las alertas.
  //    Por (astronauta, indicador) solo la alerta más reciente queda activa; el resto, cerradas.
  const INDICATOR_LABELS: Record<string, string> = {
    heartRate: "Heart rate",
    bloodPressure: "Blood pressure",
    glucose: "Blood glucose",
    temperature: "Body temperature",
    spo2: "Oxygen saturation (SpO2)",
    sleep: "Sleep hours",
    mood: "Mood",
  };
  const incidentRows: Prisma.IncidentCreateManyInput[] = [];
  const latestActive = new Map<string, number>(); // clave astro|indicador → índice en incidentRows
  let incidentSeq = 0;

  for (const e of evaluated) {
    for (const alert of e.evaluation.alerts) {
      const openedAt = new Date(e.planned.takenAt.getTime() + 2 * 60_000);
      const id = `seed-incident-${String(++incidentSeq).padStart(4, "0")}`;
      const key = `${e.astronautId}|${alert.indicator}`;
      const prev = latestActive.get(key);
      if (prev !== undefined) {
        // La alerta anterior del mismo tipo se cierra antes de que se abra esta
        const p = incidentRows[prev];
        const closedAt = new Date(Math.min(openedAt.getTime() - 60_000, (p.openedAt as Date).getTime() + 6 * HOUR));
        Object.assign(p, {
          status: IncidentStatus.CLOSED,
          acknowledgedAt: new Date((p.openedAt as Date).getTime() + 20 * 60_000),
          acknowledgedById: admin.id,
          closedAt,
          closedById: admin.id,
          resolutionNotes: "Repeat measurement within range after applying protocol.",
        });
      }
      incidentRows.push({
        id,
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
      });
      latestActive.set(key, incidentRows.length - 1);
    }
  }
  // Las alertas activas de hace más de 3 días también se cierran; las de 1–3 días quedan reconocidas
  for (const idx of latestActive.values()) {
    const row = incidentRows[idx];
    const age = NOW - (row.openedAt as Date).getTime();
    if (age > 3 * DAY) {
      Object.assign(row, {
        status: IncidentStatus.CLOSED,
        acknowledgedAt: new Date((row.openedAt as Date).getTime() + 25 * 60_000),
        acknowledgedById: admin.id,
        closedAt: new Date((row.openedAt as Date).getTime() + 8 * HOUR),
        closedById: admin.id,
        resolutionNotes: "Resolved after protocol; follow-up readings nominal.",
      });
    } else if (age > 1 * DAY) {
      Object.assign(row, {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date((row.openedAt as Date).getTime() + 15 * 60_000),
        acknowledgedById: admin.id,
      });
    }
  }

  // Incidentes de radiación (motor de radiación)
  incidentRows.push(
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
      createdAt: at(41 * DAY),
      acknowledgedAt: at(41 * DAY - 10 * 60_000),
      acknowledgedById: admin.id,
      closedAt: at(40 * DAY),
      closedById: admin.id,
      resolutionNotes: "Proton flux >10 MeV back below S1 threshold after 21 h. Crew dose within limits.",
    },
    {
      id: "seed-incident-rad-02",
      category: IncidentCategory.RADIATION,
      type: "SOLAR_RADIATION_STORM",
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.ACKNOWLEDGED,
      title: "Solar radiation storm (S1_MINOR)",
      description: "M5.2 flare detected by GOES-19. Proton arrival forecast in ~45 min. Orion crew to remain in cabin.",
      missionId: "mission-01",
      source: "RADIATION_ENGINE",
      metadata: { stormScale: "S1_MINOR", isSimulated: false, abortEvaImmediately: false, evacuateToStormShelter: false, powerDownExternalSensors: false, seed: true },
      openedAt: at(30 * HOUR),
      createdAt: at(30 * HOUR),
      acknowledgedAt: at(30 * HOUR - 8 * 60_000),
      acknowledgedById: admin.id,
    }
  );
  await prisma.incident.createMany({ data: incidentRows });

  const incStats = incidentRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status as string] = (acc[r.status as string] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✅ ${incidentRows.length} incidentes (${Object.entries(incStats).map(([k, v]) => `${k}: ${v}`).join(", ")}).`);

  // 6. Directivas del Flight Surgeon
  const activeMedical = incidentRows.filter((r) => r.category === IncidentCategory.MEDICAL && r.status !== IncidentStatus.CLOSED);
  const directiveRows: Prisma.DirectiveCreateManyInput[] = [
    ...activeMedical.map((r, i) => ({
      id: `seed-directive-${String(i + 1).padStart(3, "0")}`,
      astronautId: r.astronautId as string,
      issuedById: admin.id,
      incidentId: r.id,
      content: `Follow protocol ${r.protocolId}. Repeat the measurement in 2 hours and report symptoms.`,
      acknowledgedAt: r.status === IncidentStatus.ACKNOWLEDGED ? new Date((r.openedAt as Date).getTime() + 40 * 60_000) : null,
      createdAt: new Date((r.openedAt as Date).getTime() + 10 * 60_000),
    })),
    {
      id: "seed-directive-crew-01",
      astronautId: "astro-01",
      issuedById: admin.id,
      content: "Hydration target 3.0 L/day during translunar coast. Log fluid intake each evening.",
      acknowledgedAt: at(2 * DAY),
      createdAt: at(3 * DAY),
    },
    {
      id: "seed-directive-crew-02",
      astronautId: "astro-05",
      issuedById: admin.id,
      content: "Schedule a private psychological conference with the BHP team and protect 8.5 h sleep window.",
      createdAt: at(36 * HOUR),
    },
    {
      id: "seed-directive-crew-03",
      astronautId: "astro-07",
      issuedById: admin.id,
      content: "Keep ARED loads at prescription and add a blood pressure check 15 min after each session.",
      acknowledgedAt: at(39 * DAY),
      createdAt: at(40 * DAY),
    },
  ];
  await prisma.directive.createMany({ data: directiveRows });
  console.log(`✅ ${directiveRows.length} directivas.`);

  // 7. Políticas públicas de Supabase Storage (artemis-assets), si existe el esquema
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_select') THEN
            CREATE POLICY artemis_assets_public_select ON storage.objects FOR SELECT USING (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_insert') THEN
            CREATE POLICY artemis_assets_public_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_update') THEN
            CREATE POLICY artemis_assets_public_update ON storage.objects FOR UPDATE USING (bucket_id = 'artemis-assets');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'artemis_assets_public_delete') THEN
            CREATE POLICY artemis_assets_public_delete ON storage.objects FOR DELETE USING (bucket_id = 'artemis-assets');
          END IF;
        END IF;
      END
      $$;
    `);
  } catch {
    // PostgreSQL local sin el esquema storage de Supabase
  }

  console.log("🚀 Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
