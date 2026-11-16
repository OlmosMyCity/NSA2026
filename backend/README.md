# Orbvital Backend

Node.js / Express / TypeScript REST + SSE API, PostgreSQL / Prisma persistence layer, deterministic NASA-STD-3001 triage engine, Deep Space Radiation engine, and advisory Gemini layer for **Orbvital**.

> Documentation index: [Root README](../README.md) · [Frontend README](../frontend/README.md) · [Radiation Engine](../docs/RADIATION_ENGINE.md) · [Business Rules](../docs/REGLAS_DE_NEGOCIO.md)

---

## Layered Architecture (`src/`)

```text
backend/src/
├── index.ts                  # HTTP bootstrap (`Orbvital API listening at ...`)
├── app.ts                    # Express app, CORS allowlist (`ALLOWED_ORIGINS` / `CORS_ORIGIN`), routers
├── config/                   # prismaClient.ts, imageUpload.ts (Vercel Blob / Supabase fallback)
├── controller/routes/        # 9 Express routers under /api/*
├── dto/                      # Zod request/response validation schemas
├── entity/                   # Domain entities: Astronaut, Directive, FaceSample, HealthReading, Incident, Mission, User
├── exception/                # Typed HTTP & domain error hierarchy
├── repository/               # Repository interfaces (I*Repository) + Prisma implementations (Prisma*Repository)
├── security/                 # JWT authentication & role authorization (CREW, OPERATOR, ADMIN)
└── service/
    ├── admin/                # AssignMissionOperatorUseCase, CreateUserByAdminUseCase, GetTriageOverviewUseCase, SendClinicalDirectiveUseCase
    ├── astronaut/            # Create/List/Get/Update/DeleteAstronautUseCase, ManageFaceBiometricsUseCase
    ├── auth/                 # RegisterUserUseCase, LoginUserUseCase, GetCurrentUserUseCase
    ├── health/               # Evaluate, LoadDigitalTwinContextUseCase, medicalProtocols, decisionRules, decisionService (Gemini), reading CRUD & vision ingest
    ├── incident/             # List/Get/Open/Acknowledge/CloseIncidentUseCase, incidentNotificationBus, syncSystemIncidents
    ├── mission/              # Create/List/Get/Update/DeleteMissionUseCase
    ├── operator/             # GetOperatorCrewOverviewUseCase, UpdateCrewLocationUseCase
    ├── radiation/            # radiationEngine.ts + `engine/` (NOAA SWPC, NASA DONKI, relativistic SPE/CME models)
    └── storage/              # StorageService.ts
```

---

## Rules Decide, AI Advises

- **Deterministic Clinical Authority**: `service/health/evaluateReading.ts`, `medicalProtocols.ts` (20 clinical protocols aligned with frontend `medicalProtocols.ts`), `hazards.ts`, `digitalTwin.ts`, and `decisionRules.ts` evaluate 7 vitals across 4 flight phases (`1-G`, `Ascent`, `0-G`, `EDL`) and 5 habitats (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`) grounded in NASA-STD-3001 and the NASA HRP 5 spaceflight hazards.
- **Advisory Second Opinion (`decisionService.ts`)**: Optionally calls Gemini (`gemini-decision-1` via `@google/genai`, server-side only) with SHA-256 request deduplication and call-budget protection. When `DEMO_OFFLINE=true`, credentials are missing, or upstream fails, execution falls back safely to `rules-fallback` while preserving deterministic verdicts.
- **Append-Only Clinical Ledger (`prisma/migrations/`)**: Health readings cannot be updated/deleted via `PUT`/`PATCH`/`DELETE` (`405 Method Not Allowed`); clinical amendments use explicit `/invalidate` and `/corrections` endpoints.

---

## REST & SSE API Endpoints (`/api`)

| Module | Base Path | Key Endpoints |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| **Missions** | `/api/missions` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Astronauts & Twin** | `/api/astronauts` | `GET /`, `GET /biometrics/gallery`, `POST /digital-twin/evaluate`, `GET /:id/digital-twin`, `POST /:id/simulate`, `GET/PATCH /:id/location`, `GET/POST /:id/biometrics`, `DELETE /:id/biometrics/:sampleId`, `GET/POST/PUT/DELETE /:id` |
| **Health Readings** | `/api/readings` | `GET /`, `POST /`, `GET /:id`, `POST /vision-ingest`, `POST /:id/invalidate`, `POST /:id/corrections`, `GET /api/astronauts/:id/summary` |
| **Radiation** | `/api/radiation` | `GET /status`, `GET /cme-forecast`, `POST /simulate`, `POST /predict-impact` |
| **Incidents** | `/api/incidents` | `GET /`, `GET /stream` (SSE), `GET /protocols`, `GET /mission-catalog`, `GET /:id`, `POST /`, `PATCH /:id/acknowledge`, `PATCH /:id/close` |
| **Admin / Surgeon** | `/api/admin` | `GET /triage`, `GET/POST /astronauts/:id/directives`, `GET /operators`, `POST /users`, `PUT /missions/:id/operator` |
| **Operator** | `/api/operator` | `GET /crew`, `GET /crew/:astronautId` |
| **Uploads** | `/api/uploads` | `POST /astronauts`, `POST /missions` |

---

## Quickstart & Scripts

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Available scripts (`backend/package.json`):

- `npm run dev` — Start Express server with `tsx watch` (`http://localhost:4000/api`).
- `npm run build` — Run `prisma generate && tsc -p tsconfig.build.json`.
- `npm run start` — Run compiled `dist/index.js`.
- `npm test` / `npm run test:watch` — Run Vitest suite.
- `npm run lint` — Run ESLint.
- `npm run prisma:generate` / `prisma:migrate` / `prisma:deploy` / `prisma:status` / `prisma:seed` / `seed:sql` — Database lifecycle commands.

### Seeded Demo Credentials (`prisma/seed.ts`)

| Role | Email | Password |
| :--- | :--- | :--- |
| `ADMIN` (Flight Surgeon) | `elena.rodriguez@nasa.gov` | `HrpFlight#2026` |
| `USER` (Crew) | `r.wiseman@nasa.gov` | `OrionCrew#4IV` |
| `OPERATOR` (Ground Operator) | `m.chen@nasa.gov` | `GroundOps#2026` |

---

## Environment Variables (`backend/.env.example`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | API HTTP port | `4000` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `DATABASE_URL` | Pooled PostgreSQL connection string | `postgresql://...` |
| `DIRECT_URL` | Direct PostgreSQL connection string for Prisma migrations | `postgresql://...` |
| `JWT_SECRET` | Secret used to sign/verify JWTs (required; no hardcoded default) | `...` |
| `JWT_EXPIRES_IN` | JWT expiration window | `24h` |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (`CORS_ORIGIN` is also read as fallback) | `http://localhost:3000,https://orbvital-nsa2026.vercel.app` |
| `AI_SERVICE_TOKEN` | Shared bearer token for microservice / `vision-ingest` integration | `""` |
| `RADIATION_ENGINE_URL` | Optional external radiation engine URL (defaults to in-process TS engine) | `http://localhost:8003` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (primary media storage) | `""` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Optional Supabase Storage fallback | `artemis-assets` |
| `GEMINI_API_KEY` | Google Gemini API key (`@google/genai`, server-side only) | `""` |
| `DEMO_OFFLINE` | When `true`, forces deterministic `rules-fallback` without calling Gemini | `false` |
| `DECISION_API_MAX_CALLS` | Max advisory Gemini calls per process | `50` |
| `SEED_ADMIN_PASSWORD`, `SEED_CREW_PASSWORD`, `SEED_OPERATOR_PASSWORD` | Mandatory passwords when running `prisma:seed` in `production` | `""` |
| `FRESHNESS_WINDOW_MIN` | Living vitals freshness window in minutes | `15` |
