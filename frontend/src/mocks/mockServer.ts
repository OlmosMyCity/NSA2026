/**
 * Backend simulado para desarrollar sin API (NEXT_PUBLIC_USE_MOCKS=true).
 *
 * Implementa las mismas rutas, contratos y reglas de autorización que backend para
 * autenticación, misiones, astronautas, lecturas, consola del Flight Surgeon y subidas,
 * de modo que los servicios del frontend no distinguen entre este y el backend real.
 * Las rutas que no simula (gemelo digital, radiación, incidentes...) devuelven `null` y
 * httpClient las envía al backend real, igual que antes.
 *
 * httpClient lo carga con import dinámico solo en modo mock: no llega al bundle de producción.
 */
import { toIndicatorReadings } from '@/domain/health/api-adapter';
import { evaluateFreshness } from '@/domain/health/freshness';
import { summarizeZones } from '@/domain/health/summary';
import type { BodyZoneId, HealthStatus, Vitals } from '@/domain/health/types';
import { evaluateOperatorReadiness } from '@/domain/operator/readiness';
import { CREW_LOCATIONS, type CrewLocation, type OperatorCrewMember, type OperatorCrewStatus } from '@/domain/operator/types';
import { ENV } from '../config/env';
import type { Paginated } from '../domain/common/pagination';
import {
  buildReading,
  seedState,
  type MockAstronaut,
  type MockDirective,
  type MockMission,
  type MockReading,
  type MockState,
  type MockUser,
} from './mockData';


const STORAGE_KEY = 'orbvital_mock_db_v4';

class MockHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, message: string): never => {
  throw new MockHttpError(status, message);
};

// ---------- Estado persistido ----------

function load(): MockState {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<MockState> & Omit<MockState, 'directives' | 'faceSamples'>;
        return { ...stored, directives: stored.directives ?? [], faceSamples: stored.faceSamples ?? [] };
      }
    } catch {
      // Estado corrupto: se vuelve a sembrar.
    }
  }
  return seedState();
}

const db: MockState = load();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Cuota excedida o localStorage bloqueado: el estado vive en memoria.
  }
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------- Tokens (formato JWT sin firma; el backend real firma con JWT_SECRET) ----------

interface TokenUser {
  id: string;
  email: string;
  role: MockUser['role'];
}

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function issueToken(user: MockUser): string {
  const payload = { id: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 24 * 3600 };
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.mock`;
}

function readToken(header: string | null): TokenUser | null {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

const ownAstronautId = (userId: string) => db.astronauts.find((a) => a.userId === userId && !a.deletedAt)?.id ?? null;

function authResponse(user: MockUser) {
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, astronautId: ownAstronautId(user.id) ?? undefined },
    token: issueToken(user),
  };
}

// ---------- Utilidades de respuesta ----------

function paginate<T>(items: T[], query: URLSearchParams, defaultLimit = 10): Paginated<T> {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? defaultLimit);
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    fail(400, "Pagination parameters 'page' and 'limit' must be positive integers.");
  }
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    pagination: { total: items.length, currentPage: page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) },
  };
}

const matches = (q: string | null, ...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q.toLowerCase().trim()));

const withMission = (a: MockAstronaut) => {
  const m = db.missions.find((x) => x.id === a.missionId);
  const faceSamplesCount = (db.faceSamples ?? []).filter((s) => s.astronautId === a.id).length;
  return {
    ...a,
    mission: m ? { id: m.id, name: m.name } : undefined,
    _count: { faceSamples: faceSamplesCount },
  };
};

const isSameMissionOrAdmin = (user: TokenUser, targetAstronautId: string): boolean => {
  if (user.role === 'ADMIN') return true;
  const ownId = ownAstronautId(user.id);
  if (!ownId) return false;
  if (ownId === targetAstronautId) return true;
  const ownAstro = db.astronauts.find((a) => a.id === ownId && !a.deletedAt);
  const targetAstro = db.astronauts.find((a) => a.id === targetAstronautId && !a.deletedAt);
  return Boolean(ownAstro && targetAstro && ownAstro.missionId === targetAstro.missionId);
};

const withAstronaut = (r: MockReading) => {
  const a = db.astronauts.find((x) => x.id === r.astronautId);
  return { ...r, astronaut: a ? { id: a.id, name: a.name, role: a.role } : undefined };
};

const findActive = <T extends { id: string; deletedAt?: string | null }>(rows: T[], id: string, label: string): T =>
  rows.find((r) => r.id === id && !r.deletedAt) ?? fail(404, `${label} not found.`);

const latestDirective = (astronautId: string) =>
  db.directives
    .filter((d) => d.astronautId === astronautId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

const latestReading = (astronautId: string): MockReading | undefined =>
  db.readings
    .filter((r) => r.astronautId === astronautId)
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))[0];

/** Signos vivos de una lectura: vigencia según la ventana de FRESHNESS_WINDOW_MIN (como el backend). */
const freshnessOf = (latest: MockReading | undefined, nowMs: number) => {
  const f = evaluateFreshness(latest?.takenAt, nowMs);
  return { isFresh: f.phase === 'fresh' || f.phase === 'expiring', expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null };
};

const readingsOf = (astronautId: string) =>
  db.readings.filter((r) => r.astronautId === astronautId).sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));

const vitalsOf = (r: MockReading) => Object.fromEntries(VITAL_FIELDS.map((f) => [f, r[f]])) as unknown as Vitals;

/** Tripulación de las misiones asignadas a un operador (GetOperatorCrewOverviewUseCase). */
const operatorCrew = (operatorId: string) => {
  const own = new Set(db.missions.filter((m) => !m.deletedAt && m.operatorId === operatorId).map((m) => m.id));
  return db.astronauts.filter((a) => !a.deletedAt && own.has(a.missionId));
};

function operatorMember(a: MockAstronaut, nowMs: number) {
  const readings = readingsOf(a.id);
  const latest = readings[0];
  const { isFresh, expiresAt } = freshnessOf(latest, nowMs);
  const flat = latest ? toIndicatorReadings(latest) : [];
  // Aptitud con vigencia (un dato vencido no da veredicto); las zonas de la ficha, según la última lectura.
  const currentZones = summarizeZones(flat, null, nowMs);
  const zoneStatus = Object.fromEntries(Object.values(currentZones).map((z) => [z.zone, z.status])) as Record<BodyZoneId, HealthStatus>;
  const member: OperatorCrewMember = {
    astronautId: a.id,
    name: a.name,
    crewRole: a.role,
    photoUrl: a.photoUrl ?? null,
    missionId: a.missionId,
    missionName: db.missions.find((m) => m.id === a.missionId)?.name ?? 'Unassigned mission',
    status: latest && isFresh ? latest.status : 'NO_DATA',
    location: (a.currentLocation as CrewLocation | undefined) ?? null,
    locationUpdatedAt: a.locationUpdatedAt ?? null,
    lastReadingAt: latest?.takenAt ?? null,
    expiresAt,
    isFresh,
    vitals: latest ? vitalsOf(latest) : null,
    readiness: evaluateOperatorReadiness({ zoneStatus, isFresh, hasReadings: !!latest }),
  };
  return { member, readings, latest, lastZones: summarizeZones(flat) };
}

const OPERATOR_STATUS_PRIORITY: Record<OperatorCrewStatus, number> = { CRITICAL: 0, WARNING: 1, NO_DATA: 2, OK: 3 };

// ---------- Rutas ----------

interface Ctx {
  params: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
  user: TokenUser | null;
}

type Handler = (ctx: Ctx) => unknown;

const requireUser = (ctx: Ctx): TokenUser => ctx.user ?? fail(401, 'Missing or invalid authentication token.');
const requireOperator = (ctx: Ctx): TokenUser => {
  const user = requireUser(ctx);
  if (user.role !== 'OPERATOR') fail(403, 'You do not have permission to perform this action.');
  return user;
};
const requireAdmin = (ctx: Ctx): TokenUser => {
  const user = requireUser(ctx);
  if (user.role !== 'ADMIN') fail(403, 'You do not have permission to perform this action.');
  return user;
};

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? undefined : String(v));
const dateOrNull = (v: unknown) => (v === null || v === '' ? null : v === undefined ? undefined : new Date(String(v)).toISOString());

const VITAL_FIELDS: Array<keyof Vitals> = ['heartRateBpm', 'systolicMmHg', 'diastolicMmHg', 'glucoseMgDl', 'temperatureC', 'spo2Pct', 'sleepHours', 'mood'];

const routes: Array<[string, RegExp, Handler]> = [
  [
    'POST',
    /^\/auth\/login$/,
    ({ body }) => {
      const email = str(body.email)?.trim().toLowerCase();
      const user = db.users.find((u) => u.email === email && u.password === body.password);
      return authResponse(user ?? fail(401, 'Invalid credentials.'));
    },
  ],
  [
    'POST',
    /^\/auth\/register$/,
    ({ body }) => {
      const email = str(body.email)?.trim().toLowerCase();
      const name = str(body.name)?.trim();
      const password = str(body.password) ?? '';
      if (!email || !name || password.length < 6) fail(400, 'Name, email and a password of at least 6 characters are required.');
      if (db.users.some((u) => u.email === email)) fail(409, 'This email is already registered.');
      const user: MockUser = { id: newId('user'), email: email!, name: name!, role: 'USER', password };
      db.users.push(user);
      persist();
      return authResponse(user);
    },
  ],

  // Misiones
  [
    'GET',
    /^\/missions$/,
    ({ query }) =>
      paginate(
        db.missions.filter(
          (m) =>
            !m.deletedAt &&
            (!query.get('environment') || m.environment === query.get('environment')) &&
            (!query.get('status') || m.status === query.get('status')) &&
            matches(query.get('search'), m.name, m.description),
        ),
        query,
      ),
  ],
  ['GET', /^\/missions\/([^/]+)$/, ({ params }) => findActive(db.missions, params[0], 'Mission')],
  [
    'POST',
    /^\/missions$/,
    (ctx) => {
      const admin = requireAdmin(ctx);
      const { body } = ctx;
      if (!body.name || !body.description || !body.environment || !body.startDate) fail(400, 'name, description, environment and startDate are required.');
      const mission: MockMission = {
        id: newId('mission'),
        name: str(body.name)!,
        description: str(body.description)!,
        environment: body.environment as MockMission['environment'],
        status: (body.status as MockMission['status']) ?? 'PLANNING',
        startDate: new Date(String(body.startDate)).toISOString(),
        endDate: dateOrNull(body.endDate) ?? null,
        patchUrl: str(body.patchUrl) || null,
        createdById: admin.id,
        operatorId: null,
        createdAt: now(),
        updatedAt: now(),
      };
      db.missions.unshift(mission);
      persist();
      return [201, mission];
    },
  ],
  [
    'PUT',
    /^\/missions\/([^/]+)$/,
    (ctx) => {
      requireAdmin(ctx);
      const mission = findActive(db.missions, ctx.params[0], 'Mission');
      const { body } = ctx;
      Object.assign(mission, {
        ...(body.name !== undefined && { name: str(body.name) }),
        ...(body.description !== undefined && { description: str(body.description) }),
        ...(body.environment !== undefined && { environment: body.environment }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.startDate !== undefined && { startDate: new Date(String(body.startDate)).toISOString() }),
        ...(body.endDate !== undefined && { endDate: dateOrNull(body.endDate) }),
        ...(body.patchUrl !== undefined && { patchUrl: str(body.patchUrl) || null }),
        updatedAt: now(),
      });
      persist();
      return mission;
    },
  ],
  [
    'DELETE',
    /^\/missions\/([^/]+)$/,
    (ctx) => {
      requireAdmin(ctx);
      findActive(db.missions, ctx.params[0], 'Mission').deletedAt = now();
      persist();
      return [204, null];
    },
  ],

  // Astronautas
  [
    'GET',
    /^\/astronauts$/,
    ({ query }) =>
      paginate(
        db.astronauts
          .filter((a) => !a.deletedAt && (!query.get('missionId') || a.missionId === query.get('missionId')) && matches(query.get('search'), a.name, a.role))
          .map(withMission),
        query,
      ),
  ],
  [
    'GET',
    /^\/astronauts\/biometrics\/gallery$/,
    ({ query, user }) => {
      let missionId = query.get('missionId');
      if (!missionId && user && user.role === 'USER') {
        const ownId = ownAstronautId(user.id);
        const ownAstro = db.astronauts.find((a) => a.id === ownId && !a.deletedAt);
        missionId = ownAstro?.missionId ?? null;
      }
      const astros = db.astronauts.filter((a) => !a.deletedAt && (!missionId || a.missionId === missionId));
      return {
        data: astros.map((a) => {
          const samples = (db.faceSamples ?? []).filter((s) => s.astronautId === a.id);
          return {
            astronautId: a.id,
            astronautName: a.name,
            role: a.role,
            missionId: a.missionId,
            photoUrl: a.photoUrl ?? null,
            sampleCount: samples.length,
            embeddings: samples.map((s) => s.embedding),
          };
        }),
      };
    },
  ],
  [
    'GET',
    /^\/astronauts\/([^/]+)\/biometrics$/,
    ({ params }) => ({
      data: (db.faceSamples ?? []).filter((s) => s.astronautId === params[0]),
    }),
  ],
  [
    'POST',
    /^\/astronauts\/([^/]+)\/biometrics$/,
    (ctx) => {
      const user = requireUser(ctx);
      const astronautId = ctx.params[0];
      if (!isSameMissionOrAdmin(user, astronautId)) {
        fail(403, 'You can only manage facial biometrics for crew members of your own mission.');
      }
      const astro = findActive(db.astronauts, astronautId, 'Astronaut');
      const existing = (db.faceSamples ?? []).filter((s) => s.astronautId === astronautId);
      if (existing.length >= 5) {
        fail(400, 'Maximum of 5 facial biometric samples per crew member reached.');
      }
      const { body } = ctx;
      const sample = {
        id: newId('face'),
        astronautId,
        imageUrl: str(body.imageUrl) ?? '',
        label: str(body.label) || `Sample #${existing.length + 1}`,
        embedding: Array.isArray(body.embedding) ? (body.embedding as number[]) : [],
        qualityScore: typeof body.qualityScore === 'number' ? body.qualityScore : 92,
        uploadedById: user.id,
        createdAt: now(),
      };
      db.faceSamples = [...(db.faceSamples ?? []), sample];
      if (!astro.photoUrl && sample.imageUrl) {
        astro.photoUrl = sample.imageUrl;
      }
      persist();
      return [201, sample];
    },
  ],
  [
    'DELETE',
    /^\/astronauts\/([^/]+)\/biometrics\/([^/]+)$/,
    (ctx) => {
      const user = requireUser(ctx);
      const [astronautId, sampleId] = ctx.params;
      if (!isSameMissionOrAdmin(user, astronautId)) {
        fail(403, 'You can only manage facial biometrics for crew members of your own mission.');
      }
      db.faceSamples = (db.faceSamples ?? []).filter(
        (s) => !(s.astronautId === astronautId && s.id === sampleId),
      );
      persist();
      return [204, null];
    },
  ],
  ['GET', /^\/astronauts\/([^/]+)$/, ({ params }) => withMission(findActive(db.astronauts, params[0], 'Astronaut'))],
  [
    'POST',
    /^\/astronauts$/,
    (ctx) => {
      requireAdmin(ctx);
      const { body } = ctx;
      if (!body.name || !body.role || !body.missionId || body.age === undefined) fail(400, "Fields 'name', 'role', 'age' and 'missionId' are required.");
      const astronaut: MockAstronaut = {
        id: newId('astro'),
        name: str(body.name)!.trim(),
        role: str(body.role)!.trim(),
        age: Number(body.age),
        missionId: str(body.missionId)!,
        userId: str(body.userId) || null,
        photoUrl: str(body.photoUrl) || null,
        createdAt: now(),
        updatedAt: now(),
      };
      db.astronauts.unshift(astronaut);
      persist();
      return [201, withMission(astronaut)];
    },
  ],
  [
    'PUT',
    /^\/astronauts\/([^/]+)$/,
    (ctx) => {
      const user = requireUser(ctx);
      if (!isSameMissionOrAdmin(user, ctx.params[0])) {
        fail(403, 'You can only update crew members of your own mission.');
      }
      const astronaut = findActive(db.astronauts, ctx.params[0], 'Astronaut');
      const { body } = ctx;
      Object.assign(astronaut, {
        ...(body.name !== undefined && { name: str(body.name)?.trim() }),
        ...(body.role !== undefined && { role: str(body.role)?.trim() }),
        ...(body.age !== undefined && { age: Number(body.age) }),
        ...(body.missionId !== undefined && { missionId: str(body.missionId) }),
        ...(body.photoUrl !== undefined && { photoUrl: str(body.photoUrl) || null }),
        updatedAt: now(),
      });
      persist();
      return withMission(astronaut);
    },
  ],
  [
    'DELETE',
    /^\/astronauts\/([^/]+)$/,
    (ctx) => {
      requireAdmin(ctx);
      findActive(db.astronauts, ctx.params[0], 'Astronaut').deletedAt = now();
      persist();
      return [204, null];
    },
  ],

  // Ubicación del tripulante: solo él mismo o el Flight Surgeon (GetCrewLocationUseCase / UpdateCrewLocationUseCase)
  [
    'GET',
    /^\/astronauts\/([^/]+)\/location$/,
    (ctx) => {
      const user = requireUser(ctx);
      if (user.role !== 'ADMIN' && ownAstronautId(user.id) !== ctx.params[0]) fail(403, 'You can only view or update your own location.');
      const a = findActive(db.astronauts, ctx.params[0], 'Astronaut');
      return { currentLocation: a.currentLocation ?? null, locationUpdatedAt: a.locationUpdatedAt ?? null };
    },
  ],
  [
    'PATCH',
    /^\/astronauts\/([^/]+)\/location$/,
    (ctx) => {
      const user = requireUser(ctx);
      if (user.role !== 'ADMIN' && ownAstronautId(user.id) !== ctx.params[0]) fail(403, 'You can only view or update your own location.');
      const location = str(ctx.body.location);
      if (!location || !(CREW_LOCATIONS as readonly string[]).includes(location)) fail(400, "The 'location' field is not a valid location.");
      const a = findActive(db.astronauts, ctx.params[0], 'Astronaut');
      a.currentLocation = location!;
      a.locationUpdatedAt = now();
      persist();
      return { currentLocation: a.currentLocation, locationUpdatedAt: a.locationUpdatedAt };
    },
  ],

  // Lecturas de salud (un USER solo ve y registra las suyas, como en el backend)
  [
    'GET',
    /^\/readings$/,
    (ctx) => {
      const user = requireUser(ctx);
      let astronautId = ctx.query.get('astronautId');
      if (user.role !== 'ADMIN') {
        const own = ownAstronautId(user.id);
        if (!own || (astronautId && astronautId !== own)) fail(403, "You cannot view another crew member's medical history.");
        astronautId = own;
      }
      const status = ctx.query.get('status');
      const rows = db.readings
        .filter((r) => (!astronautId || r.astronautId === astronautId) && (!status || r.status === status))
        .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
        .map(withAstronaut);
      return paginate(rows, ctx.query);
    },
  ],
  [
    'POST',
    /^\/readings$/,
    (ctx) => {
      const user = requireUser(ctx);
      const { body } = ctx;
      const astronautId = str(body.astronautId);
      if (!astronautId || VITAL_FIELDS.some((f) => body[f] === undefined)) fail(400, 'All vital signs and astronautId are required.');
      if (!isSameMissionOrAdmin(user, astronautId!)) fail(403, "You can only log readings for crew members of your own mission.");
      findActive(db.astronauts, astronautId!, 'Astronaut');
      const vitals = Object.fromEntries(VITAL_FIELDS.map((f) => [f, Number(body[f])])) as unknown as Vitals;
      const reading = buildReading(newId('read'), astronautId!, vitals, str(body.takenAt) ?? now(), str(body.notes) || null);
      db.readings.push(reading);
      persist();
      return [201, withAstronaut(reading)];
    },
  ],

  // Ingesta de Vision AI (IngestVisionTelemetryUseCase): deriva ánimo y sueño de la telemetría,
  // conserva el resto de signos de la última lectura y evalúa con la tabla clínica común.
  [
    'POST',
    /^\/readings\/vision-ingest$/,
    (ctx) => {
      const user = requireUser(ctx);
      const { body } = ctx;
      const astronautId = str(body.astronautId);
      if (!astronautId) fail(400, 'The astronaut ID is required.');
      if (!isSameMissionOrAdmin(user, astronautId!)) fail(403, "You can only log telemetry for crew members of your own mission.");
      findActive(db.astronauts, astronautId!, 'Astronaut');
      const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const previous = latestReading(astronautId!);
      const valence = num(body.moodValence);
      const stress = num(body.stressIndex);
      const mood =
        valence !== undefined
          ? clamp(Math.round(((clamp(valence, -1, 1) + 1) / 2) * 4 + 1 - (stress !== undefined ? (clamp(stress, 0, 100) / 100) * 1.2 : 0)), 1, 5)
          : stress !== undefined
            ? clamp(Math.round(5 - (clamp(stress, 0, 100) / 100) * 4), 1, 5)
            : previous?.mood ?? 4;
      const quality = num(body.sleepQualityScore);
      const sleepHours = quality !== undefined ? Number((4 + (clamp(quality, 0, 100) / 100) * 5).toFixed(2)) : previous?.sleepHours ?? 7.5;
      const heartRateBpm = Math.round(num(body.heartRateBpm) || previous?.heartRateBpm || 72);
      const vitals: Vitals = {
        heartRateBpm,
        systolicMmHg: previous?.systolicMmHg ?? 118,
        diastolicMmHg: previous?.diastolicMmHg ?? 76,
        glucoseMgDl: previous?.glucoseMgDl ?? 95,
        temperatureC: previous?.temperatureC ?? 36.6,
        spo2Pct: previous?.spo2Pct ?? 98,
        sleepHours,
        mood,
      };
      const notes = `[Vision AI Auto-Sync] Cam: ${str(body.cameraMode) ?? '—'} | Mood: ${str(body.dominantMood) ?? '—'}`;
      const reading = buildReading(newId('vision'), astronautId!, vitals, str(body.takenAt) ?? now(), notes);
      db.readings.push(reading);
      persist();
      return [201, { reading, incidentsTriggered: reading.alerts.length, derivedVitals: { heartRateBpm, mood, sleepHours } }];
    },
  ],

  // Consola del Flight Surgeon (mismo contrato que AdminTriageController)
  [
    'GET',
    /^\/admin\/triage$/,
    (ctx) => {
      requireAdmin(ctx);
      // Sin lecturas: NO_DATA, entre WARNING y OK, y nunca se presenta como OK (GetTriageOverviewUseCase).
      const priority = { CRITICAL: 0, WARNING: 1, NO_DATA: 1.5, OK: 2 } as const;
      const label = { CRITICAL: 'Critical', WARNING: 'Watch', NO_DATA: 'NO_DATA', OK: 'Nominal' } as const;
      const nowMs = Date.now();
      const crew = db.astronauts
        .filter((a) => !a.deletedAt)
        .map((a) => {
          const m = db.missions.find((x) => x.id === a.missionId);
          const latest = latestReading(a.id);
          const status: keyof typeof priority = latest?.status ?? 'NO_DATA';
          const directive = latestDirective(a.id);
          return {
            astronautId: a.id,
            astronautName: a.name,
            missionId: a.missionId,
            missionName: m?.name ?? 'Unassigned mission',
            role: a.role,
            environment: m?.environment ?? null,
            status,
            heartRate: latest?.heartRateBpm ?? null,
            bloodPressure: latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : null,
            spo2: latest?.spo2Pct ?? null,
            glucose: latest?.glucoseMgDl ?? null,
            temperature: latest?.temperatureC ?? null,
            sleepHours: latest?.sleepHours ?? null,
            mood: latest?.mood ?? null,
            alerts: latest?.alerts.map((x) => x.message) ?? [],
            recommendation: latest?.recommendation ?? null,
            priorityBoosted: false,
            triagePriorityScore: priority[status],
            triagePriorityLabel: label[status],
            adaptedProtocol: null,
            latestDirective: directive
              ? { id: directive.id, content: directive.content, incidentId: directive.incidentId, acknowledgedAt: directive.acknowledgedAt, createdAt: directive.createdAt }
              : null,
            lastReadingAt: latest?.takenAt ?? null,
            ...freshnessOf(latest, nowMs),
            photoUrl: a.photoUrl,
          };
        })
        .sort((x, y) => x.triagePriorityScore - y.triagePriorityScore);
      return {
        crew,
        metrics: {
          totalCrew: crew.length,
          criticalCount: crew.filter((c) => c.status === 'CRITICAL').length,
          warningCount: crew.filter((c) => c.status === 'WARNING').length,
          nominalCount: crew.filter((c) => c.status === 'OK').length,
          noDataCount: crew.filter((c) => c.status === 'NO_DATA').length,
        },
        // Sin telemetría solar simulada: sin tormenta ni incidente de radiación activo.
        stormScale: 'S0_NOMINAL',
        activeRadiationIncident: null,
      };
    },
  ],
  [
    'GET',
    /^\/admin\/astronauts\/([^/]+)\/directives$/,
    (ctx) => {
      requireAdmin(ctx);
      const astronaut = findActive(db.astronauts, ctx.params[0], 'Astronaut');
      return { data: db.directives.filter((d) => d.astronautId === astronaut.id).sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt)) };
    },
  ],
  [
    'POST',
    /^\/admin\/astronauts\/([^/]+)\/directives$/,
    (ctx) => {
      const admin = requireAdmin(ctx);
      const content = str(ctx.body.directives)?.trim();
      if (!content) fail(400, "The directive text ('directives') is required.");
      const astronaut = findActive(db.astronauts, ctx.params[0], 'Astronaut');
      const directive: MockDirective = {
        id: newId('directive'),
        astronautId: astronaut.id,
        issuedById: admin.id,
        incidentId: str(ctx.body.incidentId) ?? null,
        content: content!,
        acknowledgedAt: null,
        createdAt: now(),
      };
      db.directives.push(directive);
      persist();
      return [201, { success: true, directive, message: `Clinical directive transmitted to ${astronaut.name}'s console.` }];
    },
  ],

  // Operadores de tierra (AdminTriageController: listOperatorAccess, createUser, assignMissionOperator)
  [
    'GET',
    /^\/admin\/operators$/,
    (ctx) => {
      requireAdmin(ctx);
      return {
        operators: db.users.filter((u) => u.role === 'OPERATOR').map(({ id, name, email }) => ({ id, name, email })),
        missions: db.missions.filter((m) => !m.deletedAt).map((m) => ({ id: m.id, name: m.name, operatorId: m.operatorId ?? null })),
      };
    },
  ],
  [
    'POST',
    /^\/admin\/users$/,
    (ctx) => {
      requireAdmin(ctx);
      const { body } = ctx;
      const email = str(body.email)?.trim().toLowerCase();
      const name = str(body.name)?.trim();
      const password = str(body.password) ?? '';
      const role = str(body.role) as MockUser['role'] | undefined;
      if (!email || !name || password.length < 10 || !role || !['ADMIN', 'USER', 'OPERATOR'].includes(role)) {
        fail(400, 'Name, email, a password of at least 10 characters and a valid role are required.');
      }
      if (db.users.some((u) => u.email === email)) fail(409, 'An account with that email already exists.');
      const user: MockUser = { id: newId('user'), email: email!, name: name!, role: role!, password };
      db.users.push(user);
      persist();
      return [201, { id: user.id, name: user.name, email: user.email, role: user.role }];
    },
  ],
  [
    'PUT',
    /^\/admin\/missions\/([^/]+)\/operator$/,
    (ctx) => {
      requireAdmin(ctx);
      const operatorId = ctx.body.operatorId === null ? null : str(ctx.body.operatorId);
      if (operatorId === undefined) fail(400, "The 'operatorId' field must be a user id or null.");
      if (operatorId !== null) {
        const user = db.users.find((u) => u.id === operatorId) ?? fail(404, 'User not found.');
        if (user.role !== 'OPERATOR') fail(400, 'The selected user does not have the operator role.');
      }
      findActive(db.missions, ctx.params[0], 'Mission').operatorId = operatorId ?? null;
      persist();
      return [204, null];
    },
  ],

  // Vista del operador de tierra (OperatorController): solo la tripulación de sus misiones
  [
    'GET',
    /^\/operator\/crew$/,
    (ctx) => {
      const operator = requireOperator(ctx);
      const nowMs = Date.now();
      return {
        crew: operatorCrew(operator.id)
          .map((a) => operatorMember(a, nowMs).member)
          .sort((x, y) => OPERATOR_STATUS_PRIORITY[x.status] - OPERATOR_STATUS_PRIORITY[y.status]),
        serverTime: new Date(nowMs).toISOString(),
        freshnessWindowMin: ENV.FRESHNESS_WINDOW_MIN,
      };
    },
  ],
  [
    'GET',
    /^\/operator\/crew\/([^/]+)$/,
    (ctx) => {
      const operator = requireOperator(ctx);
      // Un tripulante de otra misión responde como inexistente.
      const a = operatorCrew(operator.id).find((x) => x.id === ctx.params[0]) ?? fail(404, 'Crew member not found.');
      const nowMs = Date.now();
      const { member, readings, latest, lastZones } = operatorMember(a, nowMs);
      return {
        ...member,
        lastReadingStatus: latest?.status ?? null,
        alerts: latest?.alerts ?? [],
        recommendation: latest?.recommendation ?? null,
        zones: Object.values(lastZones).map((z) => ({ zone: z.zone, status: z.status, trend: 'stable' as const })),
        latestDirective: null,
        history: readings.slice(0, 30).map((r) => ({ id: r.id, takenAt: r.takenAt, status: r.status, ...vitalsOf(r) })),
        serverTime: new Date(nowMs).toISOString(),
        freshnessWindowMin: ENV.FRESHNESS_WINDOW_MIN,
      };
    },
  ],

  // Subida de imágenes (uploadRouter): devuelve la URL pública; aquí, un data URL local.
  [
    'POST',
    /^\/uploads\/(astronauts|missions)$/,
    (ctx) => {
      if (ctx.params[0] === 'missions') requireAdmin(ctx);
      else requireUser(ctx);
      const url = str(ctx.body.fileUrl);
      if (!url) fail(400, "Attach an image file in the 'file' field.");
      return [201, { url }];
    },
  ],
];

// ---------- Punto de entrada ----------

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Igual que imageUpload del backend: el archivo `patch`/`photo` se convierte en `patchUrl`/`photoUrl`. */
async function parseBody(body: BodyInit | null | undefined): Promise<Record<string, unknown>> {
  if (!body) return {};
  if (body instanceof FormData) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Array.from(body.entries())) {
      if (typeof value === 'string') out[key] = value;
      else out[key === 'patch' ? 'patchUrl' : key === 'photo' ? 'photoUrl' : key === 'file' ? 'fileUrl' : key] = await readFileAsDataUrl(value);
    }
    return out;
  }
  return JSON.parse(String(body));
}

const json = (status: number, data: unknown) =>
  status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Respuesta simulada, o `null` si la ruta no está simulada (httpClient usa entonces el fetch real). */
export async function mockFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  const { pathname, searchParams } = new URL(url, 'http://mock.local');
  const path = pathname.replace(/^.*?\/api(?=\/)/, '');
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  const route = routes.find(([routeMethod, pattern]) => routeMethod === method && pattern.test(path));
  if (!route) return null;

  // Latencia breve para que se vean los estados de carga.
  await new Promise((r) => setTimeout(r, 150));

  for (const [routeMethod, pattern, handler] of routes) {
    const match = routeMethod === method ? pattern.exec(path) : null;
    if (!match) continue;
    try {
      const ctx: Ctx = { params: match.slice(1), query: searchParams, body: await parseBody(init.body), user: readToken(headers.get('Authorization')) };
      const result = handler(ctx);
      const [status, data] = Array.isArray(result) && typeof result[0] === 'number' ? (result as [number, unknown]) : [200, result];
      return json(status, data);
    } catch (err) {
      if (err instanceof MockHttpError) return json(err.status, { error: err.message });
      return json(500, { error: err instanceof Error ? err.message : 'Mock server error.' });
    }
  }
  return null;
}
