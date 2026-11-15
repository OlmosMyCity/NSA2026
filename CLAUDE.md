# CLAUDE.md

Orbvital (NSA2026): crew health monitoring platform. Three services, each organized in layers.

## Structure

- `backend/` — Node.js 22 + Express + TypeScript + Prisma (PostgreSQL).
  - `src/controller/` controllers · `src/controller/routes/` Express routers (endpoint mapping + wiring)
  - `src/dto/` Zod request schemas
  - `src/service/<domain>/` business logic (`auth`, `astronaut`, `mission`, `health`, `incident`, `storage`, `radiation`; the space-weather engine lives in `service/radiation/engine/`)
  - `src/repository/` `I*Repository` contracts + `Prisma*Repository` implementations
  - `src/entity/` domain entities and DTO types
  - `src/security/` auth/role middlewares, rate limiter, security headers, bcrypt, JWT
  - `src/exception/` `AppError` hierarchy + global error handler
  - `src/config/` Prisma client, upload configuration
  - Flow: `routes → security → controller → service → repository`. Never call a repository from a controller.
  - Relative imports use the `.js` extension (TypeScript `NodeNext`).
- `frontend/` — Next.js 14 App Router + React 18 + Three.js.
  - `src/app/` pages · `src/components/<feature>/` UI · `src/hooks/` · `src/context/` · `src/services/` API clients · `src/domain/<feature>/` types & pure logic · `src/config/` · `src/mocks/`
  - Import with the `@/` alias (maps to `src/`).
- `vision/` — Python 3.11 FastAPI biometric service (`src/api`, `src/engines`, `src/vision`).
- `docs/` — architecture, business rules, radiation engine docs.

## Commands

```bash
cd backend && npm install && npx prisma generate && npx tsc --noEmit && npm test && npm run build
cd frontend && npm install && npx tsc --noEmit && npm run build
cd vision && .venv/bin/pytest -v
```
