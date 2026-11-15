# AI Usage Declaration — OrbVital (NASA Space Apps Challenge 2026)

> **Status:** draft prepared from the repository history on 2026-11-15.
> Items marked **☐ TEAM TO CONFIRM** cannot be verified from the code and must be completed by the team before submission.

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
| **Claude Code** (Anthropic) | Claude Opus 5.5 | Code audit, bug fixing, refactoring, tests and documentation in `apps/frontend`, `apps/backend` and `ai/vision`. |

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

AI-assisted commits already in `main` (11 of 91 at the time of writing):

| Commit | Date | Change |
| --- | --- | --- |
| `c9abc14` | 2026-11-15 | feat(vision): in-browser mock transport for /vision |
| `293a91e` | 2026-11-15 | fix(vision): prefer the real ai/vision service in mock mode |
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
- AI-written code was checked with automated tests (the backend `vitest` suite, including a parity test between frontend and backend thresholds), TypeScript checks, production builds and end-to-end browser tests.
- ☐ **TEAM TO CONFIRM:** other AI assistants used by team members outside Git (e.g. ChatGPT, GitHub Copilot, Gemini, Cursor) and what for. Add a row to the table above and to `ai-usage.json` → `development_tools`.

---

## 2. AI inside the product (runtime features)

These models are part of what OrbVital does. They are features of the solution, not generated content:

| Component | Model / technique | Where | Purpose |
| --- | --- | --- | --- |
| Clinical decision layer | Google Gemini, model id `gemini-decision-1` (server-side only, key `GEMINI_API_KEY`) | `apps/backend/src/application/health/decisionService.ts` | Second opinion on escalation to the flight surgeon over a deterministic rule engine; there is an offline fallback (`DEMO_OFFLINE`). |
| Contactless vital signs | FER+ emotion model (`emotion-ferplus-8.onnx`, ONNX Runtime) | `ai/vision` | Mood and stress estimation from the camera. |
| Contactless vital signs | Google MediaPipe Face Landmarker (`face_landmarker.task`) | `ai/vision` | Face landmarks for rPPG heart rate, PERCLOS fatigue and sleep metrics. |
| Signal vs. noise attribution | scikit-learn model trained by the team (`train_model.py`) | `ai/biology/signal_noise_engine` | Separates physiological signal from environmental noise in trends. |

The clinical status that is stored and shown to the flight surgeon comes from a deterministic, tested rule table (`HEALTH_BANDS` in `apps/backend/src/application/health/evaluateReading.ts`), not from a generative model.

---

## 3. Generated media, NASA branding and third-party assets

- The AI-assisted work in this repository is source code, tests and documentation. It does not include any NASA logo, flag, insignia or mission patch, and it does not modify NASA branding.
- Third-party assets are credited in their own folders, for example `apps/frontend/public/anatomy/CREDITS.md` (BodyParts3D, CC BY 4.0) and `apps/frontend/public/visualizer/assets/CREDITS.md`.
- ☐ **TEAM TO CONFIRM:** whether any image, icon, video or slide was AI-generated (for example `apps/frontend/public/images/web1.jpg`, `apps/frontend/public/icon.svg`, the project demo video or the presentation). Any such file must carry a visible watermark (for example "AI-generated") or metadata, be listed in `ai-usage.json` → `generated_media`, and must not contain NASA branding.

---

## 4. Checklist before submitting

- [ ] Complete the **☐ TEAM TO CONFIRM** items above.
- [ ] Watermark or tag every AI-generated image or video.
- [ ] Paste a summary of this declaration into the AI field of the Space Apps project submission form, with a link to this folder.

---

## Resumen en español

Esta carpeta es la **declaración obligatoria de uso de IA** del proyecto para el NASA Space Apps Challenge:

- **Desarrollo:** se usó **Claude Code (Anthropic, Claude Opus 5.5)** para auditar, corregir y reestructurar código, escribir tests y documentación. Cada cambio queda marcado en Git: autor `Claude` o trailer `Co-Authored-By: Claude Opus 5.5`, más el enlace `Claude-Session`. Los cambios entraron por pull requests revisados por el equipo, y las decisiones clínicas las tomó el equipo.
- **Producto:** la app usa IA como funcionalidad. Gemini (`gemini-decision-1`) sirve para la segunda opinión de escalamiento; FER+ (ONNX) y MediaPipe, para los signos vitales sin contacto; y un modelo de scikit-learn, para separar señal y ruido. El estado clínico que se guarda sale de una tabla de reglas determinista y probada, no de un modelo generativo.
- **Marca NASA:** el contenido generado con IA no incluye ni modifica logos, banderas ni insignias de la NASA.
- **Pendiente del equipo:** declarar otras herramientas de IA usadas fuera de Git y cualquier imagen, video o presentación generada con IA (con marca de agua). Ver los puntos **☐ TEAM TO CONFIRM**.
