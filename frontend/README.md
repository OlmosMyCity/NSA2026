# Orbvital Frontend (`frontend`)

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, and Three.js (`@react-three/fiber` / `@react-three/drei`) web console for astronaut physiological self-monitoring, 3D Digital Twin rehearsal, mission trajectory awareness, contactless camera biometrics, and Flight Surgeon oversight.

---

## Architectural Design

The frontend follows a **Layered Architecture** under `src/`, keeping `src/app/` (Next.js routes) thin:

| Folder | Layer | Contents |
| :--- | :--- | :--- |
| `src/app/` | Routing / pages | Next.js App Router pages and layouts |
| `src/components/<feature>/` | Presentation | UI components grouped by feature (`health`, `visualizer`, `vision`, `radiation`, `admin`, `missions`, `astronauts`, `routine`, `auth`, `landing`, `common`) |
| `src/hooks/` | State | React hooks (`useAstronauts`, `useMissions`, `useHealthReadings`, `useActiveAstronaut`, `useViewerBridge`) |
| `src/context/` | State | `AuthContext` provider |
| `src/services/` | Data access | API clients over `httpClient.ts` (health, digital twin, biodosimetry, missions, astronauts, auth, radiation, vision, routine, admin triage, storage) |
| `src/domain/<feature>/` | Domain | Types and pure client-side logic |
| `src/config/` | Configuration | `env.ts` |
| `src/mocks/` | Offline data | `mockDb.ts`, `healthHistory.ts`, `visionMock.ts` |

Highlights by feature:

- **3D Physiological Digital Twin** (`/dashboard`, `/trends`, `/readings/new`):
  - `domain/health/`: Pure clinical evaluation engine (`evaluate.ts`, `indicators.ts`, `summary.ts`, `trends.ts`, `education.ts`, `status-theme.ts`) mirroring NASA HRP thresholds and color states (`green`, `amber`, `red`).
  - `services/healthService.ts` (readings & mock fallback) and `services/digitalTwinService.ts` (server-side twin hydration, stateless What-If evaluation, Gemini Decision 1 triage).
  - `components/health/`: Interactive Three.js `Body3D` anatomical twin plus the `HealthDashboard` workspace featuring `twin/TwinOverview`, `twin/ZoneSelector`, `twin/ZoneInspector`, `twin/ThresholdSlider`, `twin/ScenarioDock`, and `TriageDecisionCard`.
- **3D Orbit & Multi-Mission Visualizer** (`/visualizer`): `components/visualizer/OrbitTrajectoryViewer.tsx` supporting Artemis IV Cislunar/Gateway NRHO, ISS LEO, Lunar Base, Mars Transit, Venus Flyby, Jupiter/Europa, custom trajectory uploads, launch vehicle overrides, and mission-clock hazard correlation (`domain/visualizer/missionClock.ts`, `phaseHazards.ts`).
- **Contactless Vision Biometrics Client** (`/vision`): connects via WebSocket (`/ws/telemetry`) or HTTP frame fallback to `vision`, rendering real-time BVP/PSD plots, PERCLOS/fatigue alerts, and automatically syncing biometric frames every **30 seconds** into `/api/readings/vision-ingest`.
- **Space-Weather Banner & Live Incident Alerts**: `components/radiation/RadiationStatusBanner.tsx` and SSE-powered `IncidentNotificationCenter.tsx` connected to `/api/incidents/stream`.
- **Flight Surgeon Console** (`/admin`): priority-sorted crew triage matrix correlated with NOAA storm scale (`components/admin/FlightSurgeonConsole.tsx`) and clinical directive dispatch.
- Missions, astronauts, routine, auth, landing and common: crew/mission management, countermeasure streaks & gamified checklists, JWT route protection, and shared mission-console UI primitives.

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

## Environment Variables (`frontend/.env.local`)

See `frontend/.env.example`:

| Variable | Example | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_HOST` | `http://localhost:4000/api` | Base URL for backend REST endpoints and SSE stream |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Root backend URL consumed by the 3D Trajectory Viewer |
| `NEXT_PUBLIC_VISION_URL` | `http://localhost:8000` | Optional `vision` FastAPI & WebSocket server URL |
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

