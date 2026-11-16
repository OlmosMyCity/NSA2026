# Orbvital Frontend

Next.js 14 (App Router, TypeScript, Tailwind CSS) client for **Orbvital** — Autonomous Deep-Space Crew Health, Contactless Vision Biometrics & Radiation Triage ([orbvital.health](https://orbvital.health)).

> Documentation index: [Root README](../README.md) · [Backend README](../backend/README.md) · [Vision README](../vision/README.md) · [Wireframes](../docs/wireframes/README.md)

---

## Key Capabilities

- **3D Digital Twin & 5-Habitat Calibration (`/dashboard`)**: Interactive Three.js / React Three Fiber anatomical model (`Body3D.tsx`, `twin/`) mapping 7 physiological vitals across 5 anatomical zones (`Heart`, `Brain & Mood`, `Blood & Respiration`, `Bones & Muscles`, `Sleep`) and 5 operational habitats (`SPACECRAFT`, `STATION`, `ROVER`, `LUNAR_BASE`, `MARS_BASE`), plus a risk-free `WhatIfPanel` & `ScenarioDock`.
- **Guided Reading Wizard & Bounded Critical Verification (`/readings/new`)**: 4-step clinical intake (`ReadingFormWizard.tsx`) paired with 20 deterministic NASA-STD-3001 clinical protocols (`domain/health/medicalProtocols.ts`: `PROTO_NOMINAL` + 19 caution/critical protocols). `CRITICAL` evaluations trigger a bounded verification loop (checklist + single confirmatory vitals re-check or explicit emergency bypass), while `WARNING` readings schedule a persistent **15-minute Follow-Up Sticky Note** (`FollowUpStickyNote.tsx`) with deep-linked re-evaluation.
- **Data Freshness & Operational Triage**: `FreshnessRing.tsx`, `FreshnessReminder.tsx`, and `useFreshnessPhase.ts` track vital validity windows (`NEXT_PUBLIC_FRESHNESS_WINDOW_MIN=15`).
- **Trends & Space-Weather Correlation (`/trends`)**: Historical biomarker charts correlated against live/fallback NOAA SWPC solar radiation scales and NASA DONKI CME telemetry.
- **3D Orbit & Mission Health Visualizer (`/visualizer`)**: Interactive NRHO mission trajectory and health timeline (`MissionHealthView.tsx`, `MissionMomentPanel.tsx`, `MissionTimeline.tsx`, backed by `/mission-viewer/index.html`).
- **Contactless Vision Biometrics (`/vision`)**: Live webcam/frame integration with the FastAPI `vision/` microservice (or automatic in-browser `visionMock.ts` fallback when running standalone).
- **Role-Based Consoles**: Crew workspace, Ground Operator supervision (`/operator`, `/operator/[id]`), and Flight Surgeon command center (`/admin`) with SSE incident alerts (`IncidentNotificationCenter.tsx`).

---

## Application Routes (`src/app/`)

| Route | View / Responsibility |
| :--- | :--- |
| `/` | Public landing & mission overview |
| `/login`, `/register`, `/profile` | Authentication & user profile |
| `/dashboard` | 3D Digital Twin, 5-zone inspector, habitat calibration, What-If dock |
| `/readings/new` | 4-step health intake wizard, protocol checklist, critical re-check, 15-min follow-up trigger |
| `/trends` | Longitudinal vitals & solar-wind correlation (`TrendsView.tsx`) |
| `/vision` | Contactless rPPG / PERCLOS / mood / identity telemetry (`VisionBiometricsPanel.tsx`) |
| `/routine` | Crew circadian, exercise & countermeasure routines |
| `/visualizer` | 3D NRHO Orbit & Mission Health Timeline |
| `/missions`, `/missions/new`, `/missions/[id]`, `/missions/[id]/edit` | Mission catalog & CRUD management |
| `/astronauts`, `/astronauts/new`, `/astronauts/[id]/edit` | Crew roster, profile & face biometrics manager |
| `/operator`, `/operator/[id]` | Ground Operator crew overview & location/health record |
| `/admin` | Flight Surgeon Console: triage matrix, clinical directives, radiation incidents, operator provisioning |

---

## Project Structure (`src/`)

```text
frontend/src/
├── app/                   # Next.js 14 App Router pages
├── components/
│   ├── admin/             # FlightSurgeonConsole, CrewTriageCard, DirectiveDialog, OperatorAccessPanel, ...
│   ├── astronauts/        # AstronautCard, AstronautForm, FaceBiometricsManager, AstronautsList, ...
│   ├── auth/              # Login & registration forms
│   ├── common/            # AppLayout, Navbar, Footer, ConfirmModal, OnboardingModal, webglSupport
│   ├── health/            # Body3D, HealthDashboard, ReadingFormWizard, FollowUpStickyNote,
│   │   ├── reading-form/  # AssessmentPanel, MoodCheckIn, VitalField, steps.ts
│   │   └── twin/          # ScenarioDock, ThresholdSlider, TwinOverview, ZoneInspector, ZoneSelector
│   ├── landing/           # Hero & feature showcases
│   ├── missions/          # MissionCard, MissionForm, MissionsList
│   ├── operator/          # OperatorConsole, OperatorCrewRecord
│   ├── radiation/         # IncidentNotificationCenter, RadiationStatusBanner
│   ├── routine/           # Routine tracking components
│   ├── vision/            # VisionBiometricsPanel
│   └── visualizer/        # MissionHealthView, MissionMomentPanel, MissionTimeline
├── config/                # Client runtime configuration
├── context/               # Auth & active crew contexts
├── domain/                # Pure TypeScript domain models & deterministic rules
│   ├── admin/
│   ├── astronauts/
│   ├── auth/
│   ├── common/
│   ├── health/            # evaluate.ts, medicalProtocols.ts, followUpStorage.ts, freshness.ts, ...
│   ├── missions/
│   ├── operator/
│   ├── routine/
│   ├── vision/
│   └── visualizer/
├── hooks/                 # useActiveAstronaut, useCrewSelection, useFreshnessPhase, useViewerBridge, ...
├── mocks/                 # mockData.ts, mockServer.ts, visionMock.ts (only bundled when NEXT_PUBLIC_USE_MOCKS=true)
└── services/              # httpClient.ts + typed REST/SSE service clients
```

---

## Quickstart & Commands

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Available scripts (`frontend/package.json`):

- `npm run dev` — Start local development server (`http://localhost:3000`).
- `npm run build` — Production Next.js build.
- `npm run start` — Serve production build.
- `npm run lint` — Run Next.js ESLint checks.

---

## Environment Variables (`frontend/.env.example`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_HOST` | Backend REST base URL (`http://localhost:4000/api` in dev, `/api` behind Vercel rewrites) | `http://localhost:4000/api` |
| `NEXT_PUBLIC_API_URL` | Backend origin used by `/visualizer` (`MissionTimeline` / `mission-viewer`) | `http://localhost:4000` |
| `NEXT_PUBLIC_USE_MOCKS` | Enable in-browser mock server (`src/mocks/`) for offline frontend-only demos | `false` |
| `NEXT_PUBLIC_FRESHNESS_WINDOW_MIN` | Living vitals freshness window in minutes (must match backend `FRESHNESS_WINDOW_MIN`) | `15` |
| `NEXT_PUBLIC_VISION_URL` | Optional Python `vision/` FastAPI microservice origin | `http://localhost:8000` |

> Media uploads go through the backend (`POST /api/uploads/*`); no Vercel Blob or Supabase storage keys are exposed to the frontend bundle.
