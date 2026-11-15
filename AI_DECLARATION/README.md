# AI Usage Declaration — OrbVital (NASA Space Apps Challenge 2026)

> **Status:** confirmed by the team on 2026-11-15. All runtime AI features, development tools, and AI-generated media assets are declared below and in [`ai-usage.json`](ai-usage.json).

The NASA Space Apps Challenge allows AI tools ("Super Intelligence", SI) and requires every team to state **how** they were used and to **clearly indicate where and how** with watermarks or metadata. Generated content may not use, contain or modify NASA branding or design elements ([official guidance](https://github.com/nasa/spaceapps/discussions/2123)).

This folder is that declaration:

| File | Purpose |
| --- | --- |
| [`README.md`](README.md) | Human-readable declaration for judges (this file). |
| [`ai-usage.json`](ai-usage.json) | Machine-readable metadata: tools, models, scope and the exact commits/paths. |

---

## 1. AI used to build the project (development assistance)

| Tool | Model | Used for |
| --- | --- | --- |
| **Claude Code** (Anthropic) | Claude Opus 5.5 | Code audit, bug fixing, refactoring, tests, wireframes and documentation in `frontend`, `backend`, `vision` and `AI_DECLARATION`. |
| **Antigravity** (Google DeepMind) | Gemini 4 Hydrogen (Medium) | Final Space Apps 2026 judging & eligibility audit against official guide, and `AI_DECLARATION` / `README.md` verification. |

### Where (traceable in Git)

Every AI-assisted change is marked in the Git history. This is the metadata the rules ask for:

- **Commit author** `Claude` and/or the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Trailer** `Claude-Session: https://claude.ai/code/session_…` linking each commit to the session that produced it.
- **Pull requests** opened from `claude/*` branches, with the footer *"Generated with Claude Code"*:
  - [#1](https://github.com/OlmosMyCity/NSA2026/pull/1) — frontend audit: unified clinical thresholds, auth/UX fixes, mock backend in the HTTP client, shared hooks, split of large components, AI declaration.
  - [#2](https://github.com/OlmosMyCity/NSA2026/pull/2) and [#3](https://github.com/OlmosMyCity/NSA2026/pull/3) — Vision AI page fixes, idempotent demo seed, append-only health data.

To list every AI-assisted commit:

```bash
git log --format='%h %an %s' | grep -i claude
git log --format='%h %s %(trailers:key=Co-Authored-By,valueonly)' | grep -i 'claude'
```

AI-assisted commits already in `main` (44 of 145 commits on `HEAD` at the time of update, including initial PRs #1–#3 plus subsequent layered-architecture, ESLint, wireframe and seed commits):

| Commit | Date | Change |
| --- | --- | --- |
| `c9abc14` | 2026-11-15 | feat(vision): in-browser mock transport for /vision |
| `293a91e` | 2026-11-15 | fix(vision): prefer the real vision service in mock mode |
| `edf9c9a` | 2026-11-15 | fix(frontend): allow camera for same origin so /vision webcam works |
| `f40204b` | 2026-11-15 | fix(vision): explain why the webcam could not start |
| `f9491a0` | 2026-11-15 | feat(vision): animated 3D anatomical head |
| `721fdff` | 2026-11-15 | feat(backend): realistic, idempotent demo seed |
| `88b98a0` | 2026-11-15 | chore(backend): seed.sql generated from seed.ts |
| `b992a7a` | 2026-11-15 | feat(backend): append-only health data with Prisma Migrate baseline |
| `6f6d028`, `363f641`, `8aec459` | 2026-11-15 | merges of `main` into the AI branch |

The commits of PR #1 carry the same trailers and are listed in the PR.

### How (human oversight)

- The team defined the problem, the architecture and every product decision. The AI proposed changes, and team members reviewed and merged them through pull requests.
- Clinical choices were made by the team, not the AI. Example: when the frontend, backend and digital twin disagreed on temperature and SpO₂ thresholds, a team member chose the official values (the digital-twin thresholds).
- AI-written code was checked with automated tests (the backend `vitest` suite — 25 files, 219 tests passing — including a parity test between frontend and backend thresholds), TypeScript checks, production builds and end-to-end browser tests.
- No additional external AI coding assistants were used outside Git beyond **Claude Code** and **Antigravity**.

---

## 2. AI inside the product (runtime features)

These models are part of what OrbVital does. They are features of the solution, not generated content:

| Component | Model / technique | Where | Purpose |
| --- | --- | --- | --- |
| Clinical decision layer | Google Gemini, model id `gemini-decision-1` (server-side only, key `GEMINI_API_KEY`) | `backend/src/service/health/decisionService.ts` | Second opinion on escalation to the flight surgeon over a deterministic rule engine; there is an offline fallback (`DEMO_OFFLINE`). |
| Contactless vital signs | FER+ emotion model (`emotion-ferplus-8.onnx`, ONNX Runtime) | `vision` | Mood and stress estimation from the camera. |
| Contactless vital signs | Google MediaPipe Face Landmarker (`face_landmarker.task`) | `vision` | Face landmarks for rPPG heart rate, PERCLOS fatigue and sleep metrics. |
| Signal vs. noise attribution | scikit-learn model trained by the team (`train_model.py` in companion `biology/signal_noise_engine`) | `frontend/src/components/health/SignalNoisePanel.tsx` | Separates physiological signal from environmental noise in trends. |

The clinical status that is stored and shown to the flight surgeon comes from a deterministic, tested rule table (`HEALTH_BANDS` in `backend/src/service/health/evaluateReading.ts`), not from a generative model.

---

## 3. Generated media, NASA branding and third-party assets

- The AI-assisted work in this repository is source code, tests and documentation. It does not include any NASA logo, flag, insignia or mission patch, and it does not modify NASA branding.
- Third-party assets are credited in their own folders, for example `frontend/public/anatomy/CREDITS.md` (BodyParts3D, CC BY 4.0) and `frontend/public/visualizer/assets/CREDITS.md`.
- **AI-generated visual assets in the repository (no NASA branding):**
  - `frontend/public/images/web1.jpg`: AI-generated lunar silhouette background image (1920x1280 JPEG). Contains no NASA logos, flags, insignia, or mission patches.
  - `frontend/public/icon.svg`: AI-generated vector monogram icon (`OV` on `#000000` with `#5C6B8A`), tagged with an embedded `<metadata>` disclosure. Contains no NASA branding.
- **Demo slides / video:** If AI tools are used to generate or enhance any slide or video clip for the final 7-slide / 30-second demo, it must carry a visible `"AI-generated"` watermark or metadata and contain no NASA branding.

---

## 4. Checklist & Ready-to-Paste Submission Text

- [x] Development AI tools confirmed and traced (`Claude Code` + `Antigravity`).
- [x] AI-generated repository media (`web1.jpg`, `icon.svg`) declared and verified free of NASA branding.
- [ ] Watermark or tag the final demo slides/video if any AI-generated media is added there.
- [ ] Paste the summary below into the AI field of the Space Apps project submission form, with a link to `https://github.com/OlmosMyCity/NSA2026/tree/main/AI_DECLARATION`:

> **Space Apps AI Field Summary (copy/paste):**  
> *AI tools were used both in development and as runtime features of OrbVital. For development, Claude Code (Anthropic, Claude Opus 5.5) and Antigravity (Google DeepMind, Gemini 4 Hydrogen) assisted with code auditing, refactoring, unit tests, and documentation, with full Git traceability (`Co-Authored-By` trailers and PRs #1–#3) under human clinical and architectural oversight. In runtime, OrbVital uses Google Gemini (`gemini-decision-1`, server-side with deterministic fallback `DEMO_OFFLINE`) as an advisory second-opinion triage layer over deterministic NASA-STD-3001 rules, plus MediaPipe Face Landmarker and ONNX FER+ for contactless rPPG/PERCLOS/mood biometrics, and a team-trained scikit-learn signal-vs-noise model. Two static UI assets (`frontend/public/images/web1.jpg` and `frontend/public/icon.svg`) were AI-generated and contain no NASA logos, flags, or insignia. Full machine-readable metadata is in `AI_DECLARATION/ai-usage.json`.*

---

## Resumen en español

Esta carpeta es la **declaración obligatoria de uso de IA** del proyecto para el NASA Space Apps Challenge:

- **Desarrollo:** se usó **Claude Code (Anthropic, Claude Opus 5.5)** para auditar, corregir y reestructurar código, escribir tests y documentación. Cada cambio queda marcado en Git: autor `Claude` o trailer `Co-Authored-By: Claude Opus 5.5`, más el enlace `Claude-Session`. Los cambios entraron por pull requests revisados por el equipo, y las decisiones clínicas las tomó el equipo.
- **Producto:** la app usa IA como funcionalidad. Gemini (`gemini-decision-1`) sirve para la segunda opinión de escalamiento; FER+ (ONNX) y MediaPipe, para los signos vitales sin contacto; y un modelo de scikit-learn, para separar señal y ruido. El estado clínico que se guarda sale de una tabla de reglas determinista y probada, no de un modelo generativo.
- **Marca NASA:** el contenido generado con IA no incluye ni modifica logos, banderas ni insignias de la NASA.
- **Pendiente del equipo:** declarar otras herramientas de IA usadas fuera de Git y cualquier imagen, video o presentación generada con IA (con marca de agua). Ver los puntos **☐ TEAM TO CONFIRM**.
