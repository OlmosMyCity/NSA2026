# Health Data Business & Integrity Rules (`P1–P8`)

Architectural and database integrity principles governing the Orbvital backend and PostgreSQL schema across the backend layers (`controller` -> `service` -> `repository` -> `entity`).

| # | Principle | Status | Enforcement Layer |
|---|---|---|---|
| **P1** | **Health data is append-only.** Readings are never edited or deleted in place. An erroneous entry is **invalidated** with an audit reason; a correction is a **new reading** linking back to the original (`supersedesId`). | Implemented | REST API + PostgreSQL Trigger |
| **P2** | Timestamps in UTC; mission day alignment | Planned | `timestamptz` migration & domain `missionDay()` helper |
| **P3** | Measurement units encoded in field names | Implemented (code) | `heartRateBpm`, `spo2Pct`, `glucoseMgDl`, `temperatureC`, `systolicMmHg`, `diastolicMmHg`, `sleepHours` |
| **P4** | Textual enum safety | Implemented | Native Postgres enums |
| **P5** | Enforce **physically possible** ranges at database level; **clinical** severity in domain logic | Implemented | `CHECK` constraints in `health_readings` + Zod; `evaluateReading` determines clinical risk |
| **P6** | No physical deletion of medical history | Implemented | Readings: append-only trigger + `RESTRICT` FK; Astronauts/Missions: soft-delete (`deletedAt`) |
| **P7** | Schema evolves strictly through versioned migrations | Implemented | Prisma Migrate (`prisma migrate deploy` in production) |
| **P8** | `BIGINT IDENTITY` IDs | Not adopted | UUID / readable crew IDs (`astro-01`) preserved for frontend routing compatibility |

---

## P1 Deep Dive: Append-Only Health Telemetry

### REST API Contract

| Action | Endpoint | Authorization |
|---|---|---|
| Record reading | `POST /api/readings` | Crew member (own profile) or `ADMIN` |
| Invalidate reading | `POST /api/readings/:id/invalidate` `{ reason }` | Crew member (own profile) or `ADMIN` |
| Correct reading | `POST /api/readings/:id/corrections` `{ ...vitals, reason }` | Crew member (own profile) or `ADMIN` |
| Edit / Delete | `PUT`, `PATCH`, `DELETE /api/readings/:id` | **`405 Method Not Allowed`** (disabled) |
| Audit log | `GET /api/readings?includeInvalid=true` | Returns both valid and invalidated readings |

- **Audit Invalidation:** `reason` is mandatory (5–500 characters) and invalidation is **permanent** (`isValid = false`).
- **Transactional Correction:** Submitting a correction re-evaluates clinical vitals via `evaluateReading`, preserves the original `astronautId` and default `takenAt`, triggers any resulting medical incidents, creates the superseding record (`supersedesId`), and invalidates the prior record inside a single database transaction.
- **Active Consumer Filtering:** Dashboards, longitudinal summaries, Digital Twin evaluations, Flight Surgeon triage, and Vision telemetry sync read **valid readings only** (`isValid = true`).

Use cases: `InvalidateHealthReadingUseCase`, `CorrectHealthReadingUseCase`.

### PostgreSQL Trigger & Migration (`20261115000000_immutable_health_data`)

- Added integrity columns: `isValid`, `invalidatedAt`, `invalidatedReason`, `invalidatedById`, `supersedesId` (unique).
- Trigger `health_readings_append_only`:
  - Rejects `DELETE` statements on `health_readings`.
  - Rejects modifications to clinical vitals, clinical status, alerts, notes, or timestamps.
  - Allows only a one-way transition of `isValid` from `true` -> `false` accompanied by metadata.
- Added `CHECK` constraints mirroring physically plausible vital ranges (matching Zod limits) and invalidation field completeness.
- Changed `astronautId` foreign key from `CASCADE` to `RESTRICT`: crew records with persisted health readings cannot be physically purged.
- Migrated historical soft-deleted readings (`deletedAt IS NOT NULL`) to `isValid = false`.

> **Seed / Maintenance Exception:** Idempotent seed scripts (`prisma/seed.ts` and `prisma/seed.sql`) temporarily set `SET LOCAL orbvital.allow_health_purge = 'on';` inside a transaction solely to reset demo fixtures.

---

## P7: Applying Migrations

### Fresh Database
```bash
cd backend && npm run prisma:deploy
```

### Existing Database (Baseline Stamp + Deploy)
```bash
cd backend
npx prisma migrate resolve --applied 20261101000000_baseline
npx prisma migrate resolve --applied 20261114_directives_and_cleanup
npm run prisma:deploy
```

### Future Schema Changes
```bash
npx prisma migrate dev --name describe_change   # Generate migration locally
npm run prisma:deploy                           # Apply in staging/production
```
Never edit previously applied migrations; always create a new incremental migration and run `prisma:deploy` before releasing backend code that depends on the updated schema.
