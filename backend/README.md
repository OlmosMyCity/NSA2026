# Orbvital Backend API (`backend`)

Node.js 22, Express, TypeScript, and Prisma ORM service organized in a Layered Architecture (`controller` → `service` → `repository`) for append-only crew medical telemetry, deterministic Digital Twin evaluation, Gemini Decision 1 triage orchestration, embedded `backend/src/service/radiation/engine` telemetry, and real-time Flight Surgeon incident management.

---

## Layers (`src/`)

| Folder | Layer | Contents |
| :--- | :--- | :--- |
| `controller/` | Presentation | Express controllers (`*Controller.ts`) |
| `controller/routes/` | Presentation | Express routers: endpoint mapping, middleware chain and dependency wiring per resource |
| `dto/` | Presentation | Zod request schemas (`schemas.ts`) |
| `security/` | Cross-cutting | `authenticate`, `authorizeRoles`, `rateLimiter`, `securityHeaders`, `PasswordHasher` (bcrypt), `TokenService` (JWT) |
| `exception/` | Cross-cutting | `AppError` hierarchy and the global `errorHandler` |
| `config/` | Cross-cutting | Prisma client singleton (`prismaClient.ts`), multipart upload configuration (`imageUpload.ts`) |
| `service/` | Business | Business logic grouped by domain (see below) |
| `repository/` | Data access | Repository contracts (`I*Repository.ts`) and their Prisma implementations (`Prisma*Repository.ts`) |
| `entity/` | Model | Domain entities and DTO types (`Astronaut`, `Mission`, `HealthReading`, `Incident`, `Directive`, `User`) |

Request flow: `routes` → `security` → `controller` → `service` → `repository` → PostgreSQL. Errors bubble up to `exception/errorHandler`.

### `service/`
- `auth/`, `astronaut/`, `mission/`: one class per operation (`Create*`, `Update*`, `Delete*`, `List*`, `Get*ById`, `LoginUser`, `RegisterUser`, `GetCurrentUser`).
- `health/`:
  - Operations: `CreateHealthReadingUseCase`, `InvalidateHealthReadingUseCase`, `CorrectHealthReadingUseCase`, `ListHealthReadingsUseCase`, `GetHealthReadingByIdUseCase`, `GetAstronautHealthSummaryUseCase`, `IngestVisionTelemetryUseCase`, `BiodosimetryTriageUseCase`.
  - `evaluateReading.ts`: Clinical threshold validator & NASA HRP alert generator across the 7 core vital signs.
  - `hazards.ts`: NASA HRP 5-Hazard matrix and environment multipliers (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`).
  - `digitalTwin.ts`: Temporal multi-zone state aggregator (`heart`, `brain`, `blood`, `bones`, `sleep`), trend slope detection, overdue reading alarms, and stateless What-If evaluation.
  - `decisionRules.ts`: Deterministic official triage engine (`re_measure`, `rest`, `exercise`, `shelter_shielding`, `contact_ground`, `no_action`).
  - `decisionService.ts`: Server-side `@google/genai` (`gemini-decision-1`) integration acting strictly as a second-opinion triage estimator with SHA cache, call budget cap (`DECISION_API_MAX_CALLS`), offline fallback, and rule-authority preservation.
  - `correlation.ts`: Cross-domain escalation combining clinical severity with `S3+` solar storms (`P0_STORM_CRITICAL`).
  - `medicalProtocols.ts`: Structured action & countermeasure protocol catalog.
- `incident/`: incident lifecycle operations, real-time `incidentNotificationBus.ts` (SSE broadcaster & SLA timeout escalator), `syncSystemIncidents.ts` and the crewed mission contingency catalog.
- `admin/`: flight-surgeon operations (`GetTriageOverviewUseCase`, `SendClinicalDirectiveUseCase`, `CreateUserByAdminUseCase`, `AssignMissionOperatorUseCase`).
- `operator/`: ground-operator crew supervision (`GetOperatorCrewOverviewUseCase`, `UpdateCrewLocationUseCase`); data freshness and destination readiness rules live in `health/freshness.ts` and `health/readiness.ts`.
- `storage/`: dual `StorageService` (Vercel Blob primary, Supabase Storage fallback).
- `radiation/`: singleton `radiationEngine.ts` and the embedded space-weather physics engine (`engine/`: NOAA/NASA clients, SEP prediction, dose calculator, solar-wind impact, mitigation rules, storm simulator).

---

## Key Architectural Invariants

- **Append-Only Medical Integrity (`P1–P7`):** Health readings are never updated or deleted in place (`PUT/PATCH/DELETE /api/readings/:id` return `405`). Erroneous records are formally invalidated with a required reason (`POST /api/readings/:id/invalidate`) or superseded transactionally by a new linked reading (`POST /api/readings/:id/corrections`), enforced in PostgreSQL via the `health_readings_append_only` trigger and Prisma Migrate.
- **Authoritative Rules vs. AI Second Opinion:** Deterministic clinical rules in `decisionRules.ts` always establish `official` triage outcomes (`escalar`, `accion`, zone scores). Model outputs from `gemini-decision-1` are bounded by strict closed-set schemas and always carry confidence scores and the model-estimate disclaimer.
- **Database Persistence & Serverless Safety:** Express runs both as a long-lived Node server (`npm run dev` / `npm start`) and via `vercel.json` serverless rewrite (`src/index.ts`). Prisma uses pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connections with singleton reuse across invocations.
- **Automated Incident Lifecycle:** Abnormal `HealthReading` creation/correction or `S1`–`S5` solar storm detection deduplicates and opens `Incident` records automatically while emitting SSE frames to ground Flight Surgeons.

---

## Environment Variables (`backend/.env`)

See `backend/.env.example`:

| Variable | Purpose |
| :--- | :--- |
| `PORT` | HTTP port (`4000` by default) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `DATABASE_URL` | PostgreSQL pooled connection string (e.g., port 6543 with PgBouncer) |
| `DIRECT_URL` | Direct PostgreSQL connection string for Prisma Migrate (`prisma migrate deploy`) |
| `JWT_SECRET` | Cryptographic secret for signing/verifying JWT bearer tokens |
| `JWT_EXPIRES_IN` | Token lifetime (e.g., `24h`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origin whitelist |
| `GEMINI_API_KEY` | Server-side Google Gemini API key for `gemini-decision-1` |
| `DEMO_OFFLINE` | Set `"true"` to bypass Gemini API network calls via deterministic fallback |
| `DECISION_API_MAX_CALLS` | Hard upper bound on Gemini Decisions API calls per process lifetime |
| `BLOB_READ_WRITE_TOKEN` | Optional Vercel Blob read/write token for uploads |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Optional Supabase Storage fallback configuration |

---

## Commands

```bash
npm run build         # Runs prisma generate & compiles TypeScript (radiation engine included)
npm run dev           # Watch mode server via tsx
npm run start         # Run compiled dist/index.js
npx tsc --noEmit      # Strict TypeScript check
npm test              # Execute all Vitest unit & integration suites
npm run prisma:deploy # Apply versioned Prisma migrations (prisma migrate deploy)
npx prisma db seed    # Populate idempotent crewed mission & baseline health datasets
```
