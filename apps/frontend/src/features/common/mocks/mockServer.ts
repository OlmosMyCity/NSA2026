/**
 * Backend simulado para desarrollar sin API (NEXT_PUBLIC_USE_MOCKS=true).
 *
 * Implementa las mismas rutas, contratos y reglas de autorización que apps/backend para
 * autenticación, misiones, astronautas, lecturas, consola del Flight Surgeon y subidas,
 * de modo que los servicios del frontend no distinguen entre este y el backend real.
 * Las rutas que no simula (gemelo digital, radiación, incidentes...) devuelven `null` y
 * httpClient las envía al backend real, igual que antes.
 *
 * httpClient lo carga con import dinámico solo en modo mock: no llega al bundle de producción.
 */
import type { Vitals } from '@/features/health/domain/types';
import type { Mission } from '@/features/missions/domain/types';
import type { Paginated } from '../domain/pagination';
import {
  buildReading,
  seedState,
  type MockAstronaut,
  type MockDirective,
  type MockReading,
  type MockState,
  type MockUser,
} from './mockData';


const STORAGE_KEY = 'orbvital_mock_db_v3';

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
        const stored = JSON.parse(raw) as Partial<MockState> & Omit<MockState, 'directives'>;
        return { ...stored, directives: stored.directives ?? [] };
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
  return { ...a, mission: m ? { id: m.id, name: m.name } : undefined };
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

const latestReading = (astronautId: string) =>
  db.readings
    .filter((r) => r.astronautId === astronautId)
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))[0];

// ---------- Rutas ----------

interface Ctx {
  params: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
  user: TokenUser | null;
}

type Handler = (ctx: Ctx) => unknown;

const requireUser = (ctx: Ctx): TokenUser => ctx.user ?? fail(401, 'Missing or invalid authentication token.');
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
      const mission: Mission = {
        id: newId('mission'),
        name: str(body.name)!,
        description: str(body.description)!,
        environment: body.environment as Mission['environment'],
        status: (body.status as Mission['status']) ?? 'PLANNING',
        startDate: new Date(String(body.startDate)).toISOString(),
        endDate: dateOrNull(body.endDate) ?? null,
        patchUrl: str(body.patchUrl) || null,
        createdById: admin.id,
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
      requireAdmin(ctx);
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
      if (user.role !== 'ADMIN' && ownAstronautId(user.id) !== astronautId) fail(403, "You cannot log readings for another crew member.");
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
      if (user.role !== 'ADMIN' && ownAstronautId(user.id) !== astronautId) fail(403, "You cannot log telemetry for another crew member.");
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
      const priority = { CRITICAL: 0, WARNING: 1, OK: 2 } as const;
      const label = { CRITICAL: 'Critical', WARNING: 'Watch', OK: 'Nominal' } as const;
      const crew = db.astronauts
        .filter((a) => !a.deletedAt)
        .map((a) => {
          const m = db.missions.find((x) => x.id === a.missionId);
          const latest = latestReading(a.id);
          const status = latest?.status ?? 'OK';
          const directive = latestDirective(a.id);
          return {
            astronautId: a.id,
            astronautName: a.name,
            missionId: a.missionId,
            missionName: m?.name ?? 'Unassigned mission',
            role: a.role,
            environment: m?.environment ?? 'LUNAR_BASE',
            status,
            heartRate: latest?.heartRateBpm ?? 70,
            bloodPressure: latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : '118/76',
            spo2: latest?.spo2Pct ?? 98,
            glucose: latest?.glucoseMgDl ?? 95,
            temperature: latest?.temperatureC ?? 36.6,
            sleepHours: latest?.sleepHours ?? 7.5,
            mood: latest?.mood ?? 4,
            alerts: latest?.alerts.map((x) => x.message) ?? [],
            recommendation: latest?.recommendation ?? null,
            priorityBoosted: false,
            triagePriorityScore: priority[status],
            triagePriorityLabel: label[status],
            adaptedProtocol: null,
            latestDirective: directive
              ? { id: directive.id, content: directive.content, incidentId: directive.incidentId, acknowledgedAt: directive.acknowledgedAt, createdAt: directive.createdAt }
              : null,
            lastReadingAt: latest?.takenAt ?? a.createdAt,
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

  // Subida de imágenes (uploadRouter): devuelve la URL pública; aquí, un data URL local.
  [
    'POST',
    /^\/uploads\/(astronauts|missions)$/,
    (ctx) => {
      requireAdmin(ctx);
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
