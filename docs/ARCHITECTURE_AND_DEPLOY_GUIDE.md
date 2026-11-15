# Architecture & Zero-Cost Deployment Guide (Orbvital / NSA2026)

> **Purpose:** Authoritative technical inventory, monorepo boundaries, and zero-cost cloud deployment blueprint for **Orbvital (`NSA2026`)**. Keeping all AI inference lightweight and embedding shared domain packages avoids cold-start hops and eliminates paid GPU/tier lock-in.

---

## 1. Monorepo Architecture Inventory

The repository is structured as a unified monorepo separating user-facing applications (`apps/`), shared physics packages (`packages/`), and Python AI microservices (`ai/`), with root `vercel.json` routing Frontend and Backend seamlessly under one origin:

| Directory | Stack / Runtime | Local Port | Responsibility | Production Target |
| :--- | :--- | :--- | :--- | :--- |
| `apps/frontend/` | Next.js 14, React 18, Tailwind CSS, Three.js (`@react-three/fiber`) | `3000` | Web console ("lunar editorial"), 3D Digital Twin (`/dashboard`), 3D Orbit Visualizer (`/visualizer`), AI Vision client (`/vision`), Flight Surgeon Console (`/admin`), Crew Routine (`/routine`) | `frontend` service in `vercel.json` (**Vercel Free**, `/(.*)`) |
| `apps/backend/` | Node.js 22, Express 4, TypeScript, Prisma 6, `@google/genai`, SSE | `4000` | Clean Architecture REST API, JWT Auth, Missions/Crew/Readings CRUD, Deterministic Digital Twin + `gemini-decision-1` Triage, Incident SLA Lifecycle & SSE Stream, `/api/radiation/*`, `/health` & `/api/health` | `backend` service in `vercel.json` (**Vercel Functions Free**, `/api/(.*)` & `/health`) + **Render Free** blueprint option |
| `packages/radiation-engine/` | TypeScript (`@nsa2026/radiation-engine`) | — *(embedded in `apps/backend`, optional standalone `4000`)* | Relativistic Solar Particle Event (SPE) arrival window, NOAA SWPC & NASA DONKI ingestion, shielding dose attenuation (`EVA_SUIT`, `CREW_CABIN_NOMINAL`, `STORM_SHELTER`), storm simulator | Compiled library consumed directly by `apps/backend` |
| `ai/vision/` | Python 3.11, FastAPI, WebSockets, MediaPipe, ONNX Runtime, OpenCV, SciPy | `8000` | Contactless optical biometrics: RGB POS/CHROM & NIR rPPG BPM/HRV, EAR/PERCLOS fatigue & actigraphy, ONNX FERPlus + Action Units mood/stress | Containerized FastAPI (**Hugging Face Spaces Free** 16 GB RAM or **Render Free**) |
| `docs/` | Markdown | — | Architecture, NASA Space Apps challenge alignment, radiation engine specs | Documentation |

---

## 2. Folder Layout & Module Boundaries

```text
NSA2026/
├── apps/
│   ├── frontend/                # Next.js 14 App Router + Feature-Sliced UI (src/features/*)
│   └── backend/                 # Express Clean Architecture + Prisma + Gemini Decisions API + Radiation SDK
├── packages/
│   └── radiation-engine/        # @nsa2026/radiation-engine (compiled to dist/ and imported by backend)
├── ai/
│   └── vision/                  # CPU-optimized Python FastAPI biometric telemetry server
├── docs/                        # Engineering guides & challenge specification
├── package.json                 # npm workspaces tying apps/backend & packages/radiation-engine
└── vercel.json                  # Unified production rewrites (/api/* & /health -> backend, /* -> frontend)
```

### Why `@nsa2026/radiation-engine` is Embedded in `apps/backend`
Running heliophysics forecasting as an embedded workspace library inside `apps/backend`:
1. Saves an entire serverless/container allocation on free tiers.
2. Eliminates inter-service HTTP cold starts and local port collisions.
3. Enables sub-millisecond cross-domain triage correlation (`correlation.ts`) between medical incidents, Digital Twin hazard weights, and solar radiation storm scales (`S0`–`S5`).

---

## 3. Free-Tier Production Hosting Strategy

| Layer | Platform | What Runs Here | Key Operational Limits |
| :--- | :--- | :--- | :--- |
| **Frontend (`apps/frontend`)** | **Vercel Free** | Next.js pages, Three.js canvases, WebRTC webcam capture | Only expose safe public configuration via `NEXT_PUBLIC_*` |
| **Core Backend (`apps/backend`)** | **Vercel Functions Free** (primary via root `vercel.json`) or **Render Free** | Express API, Prisma client, Gemini Decision 1 client, `@nsa2026/radiation-engine` | Keep request JSON payloads bounded (`256kb`), enforce server-side API caps (`DECISION_API_MAX_CALLS`), keep Prisma singleton pooled |
| **Database & Media Storage** | **Supabase Free** / **Neon Free** + **Vercel Blob** | PostgreSQL (`users`, `missions`, `astronauts`, `health_readings`, `incidents`, `directives`) + mission/crew images | Use pooled `DATABASE_URL` (`?pgbouncer=true`) at runtime and direct `DIRECT_URL` (`5432`) for `prisma db push` |
| **AI Vision (`ai/vision`)** | **Hugging Face Spaces (Docker Free)** or **Render Free** | FastAPI + MediaPipe Face Landmarker + ONNX FERPlus (`int8`/lightweight CPU models) | Never bundle multi-GB PyTorch/CUDA weights; download `.onnx`/`.task` (~38 MB) at build time via `download_models.py` |

### AI & Runtime Guardrails
1. **CPU-Only Lightweight Inference:** `ai/vision` relies strictly on `onnxruntime`, `mediapipe`, `opencv-python-headless`, and `scipy` so it boots quickly within CPU-only containers.
2. **No Model Weights in Git:** Binary weights (`.onnx`, `.task`) and build artifacts (`dist/`, `.venv/`, `node_modules/`, `.env`) stay excluded via `.gitignore`.
3. **Server-Side Secret Isolation:** `GEMINI_API_KEY`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `BLOB_READ_WRITE_TOKEN`, and `AI_SERVICE_TOKEN` never cross into `apps/frontend`.
4. **Deterministic Fallback Guarantee:** If `GEMINI_API_KEY` is omitted or `DEMO_OFFLINE="true"`, `decisionService.ts` seamlessly returns deterministic clinical rules (`rules-fallback`), ensuring zero downtime during offline demonstrations.

---

## 4. Merge & Release Checklist

- [ ] New environment variables documented cleanly in `.env.example` without real secrets.
- [ ] Workspace package compiled (`cd packages/radiation-engine && npm run build`) before backend typechecks or deployments.
- [ ] All checks passing:
  - `cd apps/backend && npx tsc --noEmit && npm test`
  - `cd apps/frontend && npx tsc --noEmit`
  - `cd packages/radiation-engine && npm test`
  - `cd ai/vision && .venv/bin/pytest -v` (when modifying vision engines)
- [ ] CORS origins in `apps/backend/src/app.ts` and `ai/vision/src/api/app.py` include production frontend origins and localhost without wildcard `*` credentials issues.
