# Guía Viva de Arquitectura, Refactor y Despliegue Gratuito (OrbVital / NSA2026)

> **Propósito de este documento:** Ser la referencia viva del repositorio **OrbVital (`NSA2026`)**. Cada vez que el equipo agregue un nuevo módulo (por ejemplo `frontend/`, nuevos modelos de IA, nuevos microservicios o cambios en base de datos), debe actualizar este documento y seguir sus convenciones para mantener el código ordenado y garantizar que **todo siga desplegándose 100% gratis** sin romper producción.

---

## 1. Estado Actual del Codebase (Inventario Real)

Hoy el repositorio contiene tres módulos principales y documentación:

| Carpeta actual | Stack / Runtime | Puerto local | Propósito | Estado de despliegue |
| :--- | :--- | :--- | :--- | :--- |
| `backend/` | Node 22, Express, TypeScript, Prisma, Supabase | `4000` | API REST principal, auth JWT, misiones, astronautas, lecturas de salud y subida de imágenes | Blueprint `backend/render.yaml` para **Render Free** + **Supabase Free** |
| `radiation-engine/` | Node 22, Express, TypeScript | `4000` *(colisión con `backend`)* | Predicción y alerta temprana de radiación espacial (NOAA SWPC + NASA DONKI) | Compilado en `dist/` (puede usarse como librería o microservicio) |
| `Vision/` | Python 3.11, FastAPI, WebSockets, MediaPipe, ONNX Runtime, OpenCV, SciPy | `8000` | Monitoreo biométrico sin contacto: ánimo/estrés, sueño/PERCLOS y BPM/HRV por rPPG (RGB/NIR) | Local (listo para contenedor/Render/HF Spaces) |
| `docs/` | Markdown | — | Planes, reto NASA Space Apps y guía de integración de radiación | Documentación |

### Hallazgos clave detectados en el código actual
1. **Colisión de puerto local (`4000`)**: Tanto `backend/src/index.ts` como `radiation-engine/src/server.ts` usan `PORT || 4000`.
2. **CORS restringido / abierto de forma inconsistente**:
   - `backend/src/app.ts` usa `cors()` abierto, aunque `backend/render.yaml` define `CORS_ORIGIN=https://artemis-iv-frontend-eight.vercel.app`.
   - `Vision/src/api/app.py` usa `allow_origins=["*"]`.
3. **Ubicación de `render.yaml`**: Actualmente está en `backend/render.yaml`. Render busca `render.yaml` en la raíz del repositorio para Blueprints multi-servicio (o requiere configurar *Root Directory* manualmente).
4. **Build artifacts en Git**: `radiation-engine/dist/` está commiteado en Git aunque `.gitignore` raíz lista `dist`.
5. **Modelos en `Vision/`**: `Vision/models/*.onnx` y `*.task` están correctamente ignorados en `Vision/.gitignore` y se descargan con `Vision/download_models.py` (~38 MB en total).

---

## 2. Estructura Objetivo de Carpetas (Refactor Progresivo)

Para evitar que la raíz del repositorio se llene de carpetas sueltas cuando lleguen **`frontend/`**, **nuevos modelos de IA** y **nuevos servicios**, la meta es agrupar el código por responsabilidad en **4 bloques**:

```text
OrbVital/
├── apps/                        # Aplicaciones orientadas al usuario o APIs principales
│   ├── frontend/                # (En proceso) Web App (React/Next/Vite) -> Vercel Free
│   └── backend/                 # API Core (Express + Prisma + Auth) -> Render Free
│
├── ai/                          # Todos los modelos y servicios de IA / Visión (Python)
│   ├── vision/                  # Actual carpeta Vision/ (rPPG, Sueño, Ánimo)
│   └── <nuevo-modelo>/          # Futuros modelos (ej. voice-stress/, posture/, triage-llm/)
│
├── packages/                    # Librerías y contratos compartidos (sin servidor propio)
│   ├── radiation-engine/        # Actual radiation-engine/ importado directo por backend/
│   └── shared-contracts/        # (Futuro) Tipos TS / esquemas JSON compartidos
│
├── docs/                        # Documentación técnica y esta guía viva
├── infra/                       # Scripts de despliegue, Dockerfiles ligeros y CI
├── .gitignore                   # Reglas globales (Node + Python + modelos + .env)
└── render.yaml                  # Blueprint raíz unificado (opcional si usas Render)
```

> [!TIP]
> **¿Por qué mover `radiation-engine` a librería dentro de `packages/`?**
> En el plan gratuito de cada plataforma tienes un número limitado de servicios activos y RAM. Como `radiation-engine` también es TypeScript/Node.js, importarlo directamente en `apps/backend` (exponiendo `/api/radiation/*` desde el mismo Express) **ahorra 1 servidor gratuito completo**, elimina la colisión de puertos (`4000`) y evita latencia/cold-starts entre microservicios.

---

## 3. Estrategia de Hosting 100% Gratuito (Sin Sorpresas)

La arquitectura gratuita recomendada aprovecha las fortalezas y límites reales de cada plataforma sin tarjeta ni costos ocultos:

| Capa | Plataforma Gratuita | Qué aloja | Límites clave a respetar |
| :--- | :--- | :--- | :--- |
| **Frontend (`apps/frontend`)** | **Vercel Free** (o Cloudflare Pages) | UI del Dashboard, gráficas, cámara WebRTC | Builds rápidos; variables `VITE_*` o `NEXT_PUBLIC_*` solo públicas |
| **API Principal + Radiación (`apps/backend`)** | **Render Web Service (Free)** | Express + Prisma + `radiation-engine` | **512 MB RAM**, se suspende tras **15 min** sin tráfico (cold start ~30–50s), sin disco persistente |
| **Base de Datos + Archivos** | **Supabase Free** | PostgreSQL (`500 MB`) + Storage (`1 GB`, bucket `artemis-assets`) | Usar **Transaction Pooler (6543)** en `DATABASE_URL` y **Session Pooler (5432)** en `DIRECT_URL` (IPv4 compatible con Render) |
| **IA / Visión / Nuevos Modelos (`ai/vision`, `ai/*`)** | **Hugging Face Spaces (Docker Free)** *(recomendado)* o **Render Free** | FastAPI + MediaPipe + ONNX Runtime + futuros modelos | **HF Spaces Free da 16 GB RAM y 2 vCPU** (ideal para Python/OpenCV/ONNX si Render Free de 512 MB queda justo); se suspende tras 48h sin uso |

### Reglas de oro para mantener los modelos de IA gratuitos y rápidos
1. **Modelos ligeros en CPU (sin GPU)**:
   - Usar siempre formatos **ONNX (`onnxruntime`) cuantizados (`int8`/`fp16`)**, **MediaPipe**, **OpenCV** o **SciPy**, o bien inferencia externa gratuita por API cuando el modelo sea grande (LLM).
   - **Prohibido** meter PyTorch completo + CUDA (~2–4 GB) en imágenes de despliegue gratuito si solo se hace inferencia: usar `onnxruntime` (~50 MB) o `tflite-runtime`.
2. **Nunca subir pesos pesados a Git**:
   - Todo archivo `.onnx`, `.task`, `.pt`, `.bin`, `.safetensors`, `.h5` debe estar en `.gitignore`.
   - Descargar los pesos en el `Dockerfile` / `buildCommand` o al iniciar mediante script (`download_models.py`) desde GitHub Releases o Hugging Face Hub.
3. **Presupuesto de memoria**:
   - Si corre en **Render Free (512 MB RAM)**, mantener un máximo de 1–2 modelos ligeros cargados en singleton (como `_SHARED_ORT_SESSION` en `Vision`) y `workers=1` en Uvicorn.
   - Si se añaden nuevos modelos pesados, desplegar `ai/` en **Hugging Face Spaces (Docker Free, 16 GB RAM)** o agrupar los endpoints de inferencia en un solo servicio FastAPI modular (ver sección 5).

---

## 4. Plan de Refactor Seguro (Sin Romper Despliegues)

Para reorganizar el repositorio sin dañar lo que ya funciona en local ni en la nube, seguir este orden en **fases independientes**:

### Fase 1: Estandarización inmediata (sin mover carpetas aún)
- [ ] Asignar puertos distintos por defecto en desarrollo local:
  - `backend`: `4000`
  - `radiation-engine` (si se corre aparte): `4001`
  - `Vision`: `8000`
  - `frontend`: `5173` (Vite) o `3000` (Next.js)
- [ ] Configurar CORS por lista de orígenes (`CORS_ORIGINS` separada por comas) en `backend` y `Vision` para aceptar tanto `http://localhost:*` como `https://artemis-iv-frontend-eight.vercel.app` (y previews de Vercel).
- [ ] Dejar de trackear `radiation-engine/dist/` en Git (`git rm -r --cached radiation-engine/dist`) y compilarlo durante el `build`.

### Fase 2: Integración cuando entre `frontend/`
- [ ] Crear `apps/frontend/` (o `frontend/` mientras se migra) con un único archivo de configuración de endpoints (`src/config/api.ts`) que lea 2–3 variables de entorno claras:
  - `NEXT_PUBLIC_API_URL` / `VITE_API_URL` (apunta a `backend` en Render)
  - `NEXT_PUBLIC_VISION_URL` / `VITE_VISION_URL` (apunta a `Vision` en HF Spaces / Render)
  - `NEXT_PUBLIC_VISION_WS_URL` / `VITE_VISION_WS_URL` (WebSocket `wss://...`)
- [ ] En el frontend, contemplar **estados de "Despertando servicio (cold start)"** con reintentos automáticos al `/health` y `/api/health` cuando las APIs gratuitas estén dormidas.

### Fase 3: Agrupación en Monorepo (`apps/`, `ai/`, `packages/`)
- [ ] Mover `backend/` → `apps/backend/` y actualizar el **Root Directory** en el servicio de Render (o en `render.yaml` raíz) antes de hacer merge a `main`.
- [ ] Mover `Vision/` → `ai/vision/` (o unificar futuros modelos bajo un solo servidor FastAPI `ai/gateway/` si se quiere ahorrar despliegues).
- [ ] Mover `radiation-engine/` → `packages/radiation-engine/` e importarlo desde `apps/backend/` para exponer `/api/radiation/*` desde la misma API.
- [ ] Crear `prisma/migrations` en `apps/backend` y cambiar `prisma db push` por `prisma migrate deploy` en `render.yaml` cuando el esquema de BD esté estable.

### Fase 4: Automatización mínima (CI gratuita con GitHub Actions)
- [ ] Añadir un workflow ligero `.github/workflows/ci.yml` que corra en cada Pull Request:
  - `npm test` y `npm run build` en `backend/` y `radiation-engine/`.
  - `python -m pytest` en `Vision/`.
  - `npm run build` en `frontend/` cuando exista.
- [ ] Configurar **paths filters** en Render / Vercel / GitHub Actions para que un cambio en `Vision/` no dispare rebuild innecesario en `backend/` o `frontend/`.

---

## 5. Cómo Agregar Nuevos Modelos y Funcionalidades (Sin Complicar el Deploy)

Cuando alguien del equipo quiera añadir un **nuevo modelo** (ej. detección de estrés por voz, análisis de postura en microgravedad, clasificación de anomalías médicas):

1. **¿Necesita servidor propio o va como módulo dentro de `ai/vision` (FastAPI)?**
   - **Regla práctica**: Mientras el nuevo modelo sea Python + CPU ligero, agrégalo como un **nuevo router/engine** dentro del servicio FastAPI existente (ej. `src/engines/nuevo_modelo.py` + `src/api/routers/nuevo_modelo.py`). Así **no necesitas crear ni mantener otro hosting gratuito**.
   - Si requiere dependencias incompatibles, debe ir en su propia subcarpeta bajo `ai/<nombre>/` con su `Dockerfile` y `requirements.txt` independientes.
2. **Contrato de salida estandarizado**:
   - Todo motor de IA debe devolver JSON tipado con Pydantic (`timestamp`, `status`, `confidence` / `signal_quality`, `metrics`, `alerts`) para que `backend` pueda persistirlo en `HealthReading` (Prisma) y `frontend` graficarlo sin lógica ad-hoc.
3. **Persistencia en Base de Datos**:
   - Los servicios de `ai/` deben ser **stateless** (sin guardar sesiones ni archivos en disco local, ya que Render/HF borran el disco al reiniciar).
   - Toda persistencia (usuarios, misiones, historial de lecturas biométricas, imágenes) pasa por **`backend` → Supabase (PostgreSQL + Storage)**.

---

## 6. Checklist Obligatorio Antes de Hacer Merge a `main`

- [ ] ¿Las nuevas variables de entorno están documentadas en `.env.example` (sin secretos reales)?
- [ ] ¿Se evitó subir `.venv/`, `node_modules/`, `dist/`, `.env` o pesos de modelos (`.onnx`, `.pt`, `.task`) a Git?
- [ ] ¿El nuevo servicio tiene un endpoint `GET /health` rápido que responda `200 OK` en `< 1s`?
- [ ] ¿CORS permite el dominio de `frontend` en Vercel y `localhost`?
- [ ] ¿Pasan todos los tests locales (`vitest` en Node, `pytest` en Python) antes del push?
- [ ] ¿Se actualizó la **Bitácora de Arquitectura** abajo?

---

## 7. Bitácora de Arquitectura (Actualizar con cada cambio importante)

| Fecha | Cambio / Nuevo Módulo | Carpeta | Impacto en Despliegue | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-14 | Creación del Backend Core + Prisma + Supabase | `backend/` | Servicio Web Render Free (`render.yaml`) | Equipo |
| 2026-11-14 | Creación del Motor de Radiación Espacial | `radiation-engine/` | Microservicio Node o librería integrada en `backend` | Equipo |
| 2026-11-14 | Creación del Módulo Biométrico por Visión (Ánimo, Sueño, rPPG BPM) | `Vision/` | FastAPI Python CPU (ONNX + MediaPipe); apto para HF Spaces / Render | Equipo |
| *Pendiente* | Incorporación del Frontend Web | `frontend/` *(futuro `apps/frontend/`)* | Despliegue en Vercel Free; configurar `CORS_ORIGINS` | Equipo |
| *Pendiente* | Consolidación a estructura `apps/`, `ai/`, `packages/` | Raíz | Actualizar Root Directory en Render/Vercel y `render.yaml` | Equipo |
