# Orbvital Backend API (`apps/backend`)

Node.js 22, Express, TypeScript, and Prisma ORM service implementing Clean Architecture (`domain`, `application`, `infrastructure`, `interface`) for append-only crew medical telemetry, deterministic Digital Twin evaluation, Gemini Decision 1 triage orchestration, embedded `@nsa2026/radiation-engine` telemetry, and real-time Flight Surgeon incident management.

---

## Clean Architecture Layers (`src/`)

1. **`domain/`**: Core business models (`Astronaut`, `Mission`, `HealthReading`, `Incident`, `Directive`, `User`), custom HTTP error hierarchy (`AppError.ts`), and pure repository interfaces (`I*Repository.ts`).
2. **`application/`**:
   - `health/`:
     - `evaluateReading.ts`: Clinical threshold validator & NASA HRP alert generator across the 7 core vital signs.
     - `hazards.ts`: NASA HRP 5-Hazard matrix and environment multipliers (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`).
     - `digitalTwin.ts`: Temporal multi-zone state aggregator (`heart`, `brain`, `blood`, `bones`, `sleep`), trend slope detection, overdue reading alarms, and stateless What-If evaluation.
     - `decisionRules.ts`: Deterministic official triage engine (`re_measure`, `rest`, `exercise`, `shelter_shielding`, `contact_ground`, `no_action`).
     - `decisionService.ts`: Server-side `@google/genai` (`gemini-decision-1`) integration acting strictly as a second-opinion triage estimator with SHA cache, call budget cap (`DECISION_API_MAX_CALLS`), offline fallback, and rule-authority preservation.
     - `correlation.ts`: Cross-domain escalation combining clinical severity with `S3+` solar storms (`P0_STORM_CRITICAL`).
     - `medicalProtocols.ts`: Structured action & countermeasure protocol catalog.
   - `incident/`: Real-time `incidentNotificationBus.ts` (SSE broadcaster & SLA timeout escalator) and crewed mission metadata catalog.
   - `use-cases/`: Application orchestrators for `auth`, `astronaut`, `mission`, `health` (`CreateHealthReadingUseCase`, `InvalidateHealthReadingUseCase`, `CorrectHealthReadingUseCase`, `ListHealthReadingsUseCase`, `GetHealthReadingByIdUseCase`, `GetAstronautHealthSummaryUseCase`, `IngestVisionTelemetryUseCase`), and `incident` lifecycle.
3. **`infrastructure/`**: PostgreSQL/Prisma repositories (`Prisma*Repository.ts`), singleton `prismaClient.ts`, `PasswordHasher` (bcrypt), `TokenService` (JWT), dual `StorageService` (Vercel Blob primary, Supabase Storage fallback), and the singleton `radiationEngine` instance.
4. **`interface/`**: Express routers, Zod validation (`validation/schemas.ts`), controllers, and security middlewares (`authenticate`, `authorizeRoles`, `rateLimiter`, `securityHeaders`, `imageUpload`, `errorHandler`).

---

## Key Architectural Invariants

- **Append-Only Medical Integrity (`P1–P7`):** Health readings are never updated or deleted in place (`PUT/PATCH/DELETE /api/readings/:id` return `405`). Erroneous records are formally invalidated with a required reason (`POST /api/readings/:id/invalidate`) or superseded transactionally by a new linked reading (`POST /api/readings/:id/corrections`), enforced in PostgreSQL via the `health_readings_append_only` trigger and Prisma Migrate.
- **Authoritative Rules vs. AI Second Opinion:** Deterministic clinical rules in `decisionRules.ts` always establish `official` triage outcomes (`escalar`, `accion`, zone scores). Model outputs from `gemini-decision-1` are bounded by strict closed-set schemas and always carry confidence scores and the model-estimate disclaimer.
- **Database Persistence & Serverless Safety:** Express runs both as a long-lived Node server (`npm run dev` / `npm start`) and via `vercel.json` serverless rewrite (`src/index.ts`). Prisma uses pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connections with singleton reuse across invocations.
- **Automated Incident Lifecycle:** Abnormal `HealthReading` creation/correction or `S1`–`S5` solar storm detection deduplicates and opens `Incident` records automatically while emitting SSE frames to ground Flight Surgeons.

---

## Environment Variables (`apps/backend/.env`)

See `apps/backend/.env.example`:

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
npm run build         # Builds @nsa2026/radiation-engine, runs prisma generate & compiles TypeScript
npm run dev           # Watch mode server via tsx
npm run start         # Run compiled dist/index.js
npx tsc --noEmit      # Strict TypeScript check
npm test              # Execute all Vitest unit & integration suites
npm run prisma:deploy # Apply versioned Prisma migrations (prisma migrate deploy)
npx prisma db seed    # Populate idempotent crewed mission & baseline health datasets
```
