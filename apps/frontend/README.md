# Orbvital Frontend (`apps/frontend`)

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, and Three.js (`@react-three/fiber` / `@react-three/drei`) web console for astronaut physiological self-monitoring, 3D Digital Twin rehearsal, mission trajectory awareness, contactless camera biometrics, and Flight Surgeon oversight.

---

## Architectural Design

The frontend follows a **Feature-Sliced Architecture** under `src/features/`, isolating domain evaluation, state hooks, API adapters, and visual components per capability while keeping `src/app/` thin:

- `src/features/health/` — **3D Physiological Digital Twin** (`/dashboard`, `/trends`, `/readings/new`):
  - `domain/`: Pure clinical evaluation engine (`evaluate.ts`, `indicators.ts`, `summary.ts`, `trends.ts`, `education.ts`, `status-theme.ts`) mirroring NASA HRP thresholds and color states (`green`, `amber`, `red`).
  - `services/`: `healthService.ts` (readings & mock fallback) and `digitalTwinService.ts` (server-side twin hydration, stateless What-If evaluation, Gemini Decision 1 triage).
  - `components/`: Interactive Three.js `Body3D` anatomical twin plus the redesigned `HealthDashboard` workspace featuring `twin/TwinOverview`, `twin/ZoneSelector`, `twin/ZoneInspector`, `twin/ThresholdSlider`, `twin/ScenarioDock`, and `TriageDecisionCard`.
- `src/features/visualizer/` — **3D Orbit & Multi-Mission Visualizer** (`/visualizer`):
  - Interactive trajectory viewer (`OrbitTrajectoryViewer.tsx`) supporting Artemis IV Cislunar/Gateway NRHO, ISS LEO, Lunar Base, Mars Transit, Venus Flyby, Jupiter/Europa, custom trajectory uploads, launch vehicle overrides, and mission-clock hazard correlation (`missionClock.ts`, `phaseHazards.ts`).
- `src/features/vision/` — **Contactless Vision Biometrics Client** (`/vision`):
  - Connects via WebSocket (`/ws/telemetry`) or HTTP frame fallback to `ai/vision`, rendering real-time BVP/PSD plots, PERCLOS/fatigue alerts, and automatically syncing biometric frames every **30 seconds** into `/api/readings/vision-ingest`.
- `src/features/radiation/` — **Space-Weather Banner & Live Incident Alerts**:
  - `RadiationStatusBanner.tsx` and SSE-powered `IncidentNotificationCenter.tsx` connected to `/api/incidents/stream`.
- `src/features/admin/` — **Flight Surgeon Console** (`/admin`):
  - Priority-sorted crew triage matrix correlated with NOAA storm scale (`FlightSurgeonConsole.tsx`) and clinical directive dispatch.
- `src/features/missions/`, `src/features/astronauts/`, `src/features/routine/`, `src/features/auth/`, `src/features/landing/`, `src/features/common/` — Crew/mission management, countermeasure streaks & gamified checklists, JWT route protection, and shared mission-console UI primitives.

---

## Application Routes (`src/app/`)

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | Landing | Platform overview & NASA HRP 5-Hazard matrix introduction |
| `/dashboard` | Physiological Digital Twin | 3D anatomical twin, zone inspector, zero-token What-If Scenario Dock, and Gemini Decision 1 triage |
| `/trends` | Longitudinal Trends | Time-series indicator charts with green/amber/red physiological bands |
| `/vision` | AI Vision Biometrics | Webcam / simulator rPPG BPM, HRV, PERCLOS fatigue & 30s DB sync |
| `/readings/new` | Vital Log Wizard | Step-by-step capture of the 7 NASA HRP indicators with measurement instructions |
| `/routine` | Countermeasures & Routine | Daily crew health checklist, adherence streaks, and badges |
| `/visualizer` | 3D Mission Trajectory | Real-time 3D orbital/interplanetary tracker and phase hazard timeline |
| `/missions`, `/missions/new`, `/missions/[id]`, `/missions/[id]/edit` | Mission Registry | Mission lifecycle management and custom trajectory configuration |
| `/astronauts`, `/astronauts/new`, `/astronauts/[id]/edit` | Crew Roster | Crew member registry, role profiles, and medical photos |
| `/admin` | Flight Surgeon Console | Protected (`ADMIN`) triage matrix, radiation incident feed, and directive dispatch |
| `/login`, `/register` | Authentication | Crew & Flight Surgeon JWT login and registration |

---

## Environment Variables (`apps/frontend/.env.local`)

See `apps/frontend/.env.example`:

| Variable | Example | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_HOST` | `http://localhost:4000/api` | Base URL for backend REST endpoints and SSE stream |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Root backend URL consumed by the 3D Trajectory Viewer |
| `NEXT_PUBLIC_VISION_URL` | `http://localhost:8000` | Optional `ai/vision` FastAPI & WebSocket server URL |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | Toggle offline client mock storage during UI-only development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Optional Supabase URL for asset storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key>` | Optional public anon key for Supabase client storage |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | `artemis-assets` | Asset storage bucket name |

---

## Scripts

```bash
npm run dev      # Start Next.js development server on http://localhost:3000
npx tsc --noEmit # Typecheck TypeScript strictly
npm run lint     # Run Next.js ESLint checks
npm run build    # Production bundle build
```

