# Orbvital AI Vision Biometrics (`vision`)

Lightweight, **100% open-source, CPU-optimized** Python 3.11 FastAPI microservice (`astronaut_vitals`) providing non-invasive optical capture of cardiovascular vitals, sleep/fatigue biomarkers, and psychological affect from standard cabin RGB or near-infrared (NIR) video streams.

---

## Core Biometric Engines (`src/`)

1. **Facial Landmark & ROI Extraction (`src/vision/face_tracker.py`)**:
   - Extracts 478 3D facial landmarks via **MediaPipe Face Landmarker** (with OpenCV geometric fallback), segmenting glabella/forehead and cheek polygons for pulse extraction while computing normalized eyelid/mouth apertures and Action Unit geometry.
2. **Multi-Camera rPPG Heart Rate & HRV (`src/engines/rppg_engine.py`)**:
   - Supports standard RGB via **POS** (*Plane-Orthogonal-to-Skin*, Wang et al.) and **CHROM** (*Chrominance*, De Haan & Jeanne), plus a single-channel spatial-temporal **NIR-rPPG** pipeline for low-light/infrared sleep pods.
   - Applies detrending, Butterworth bandpass filtering ($0.75\text{–}3.0\text{ Hz} \equiv 45\text{–}180\text{ BPM}$), Welch spectral PSD with parabolic peak interpolation, **HRV (`RMSSD`, `SDNN` ms)**, respiration rate (RPM), and Signal Quality Index (**SQI `0–100%`**).
3. **Sleep Quality, Drowsiness & Video Actigraphy (`src/engines/sleep_engine.py`)**:
   - **`cabin_active` Mode:** Computes **EAR** (*Eye Aspect Ratio*), NASA-standard **PERCLOS** (rolling eyelid closure percentage), **MAR** (*Mouth Aspect Ratio* yawn counter), 3D head-pose pitch/yaw/roll nodding, and microsleep episode alerts.
   - **`sleep_pod` Mode:** Inter-frame motion energy actigraphy classifying rest stages (`Deep Rest`, `Light/Restless Sleep`, `Awake`) alongside composite `sleep_quality_score` (`0–100`).
4. **Mood & Psychological Stress (`src/engines/mood_engine.py`)**:
   - Fuses **ONNX Runtime** neural inference (`emotion-ferplus-8.onnx`) with geometric facial Action Units (brow furrow, smile ratio, ocular droop) to output dominant operational state, Stress Index (`0–100`), Valence (`-1.0` to `+1.0`), and Cognitive Alertness (`0–100`).

---

## API Surface (`src/api/app.py`)

- `GET /` — Built-in telemetry HUD (`src/api/static/index.html`)
- `GET /api/health` — Model load readiness (`ferplus_onnx_loaded`, `mediapipe_landmarker_loaded`, active backends)
- `GET /api/telemetry/latest` — Latest `AstronautTelemetryFrame` snapshot (warms up from `SyntheticAstronautGenerator` on cold start)
- `POST /api/telemetry/tick` — Step synthetic simulator telemetry for demo/calibration modes
- `POST /api/analyze/frame` — Analyze a single uploaded image frame (`MAX_FRAME_BYTES = 5 MB`)
- `POST /api/analyze/video` — Batch-analyze an uploaded video clip (`.mp4`, `.avi`, `.mov`, `.webm`, `.mkv`) and summarize vitals
- `POST /api/reset` — Reset sliding rPPG/sleep/mood temporal buffers
- `WS /ws/telemetry` — Bidirectional real-time stream supporting live `frame` payloads (Base64 JPEG/PNG), synthetic `tick` steps, dynamic `camera_mode`/`context` switching, and `reset`

> When `AI_SERVICE_TOKEN` is set in production (`APP_ENV=production`), sensitive endpoints and `/ws/telemetry` require the `X-Service-Token` header.

---

## Quickstart & Automated Tests

```bash
cd vision

# 1. Create Python 3.11 virtual environment and install dependencies
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Download lightweight open-source model weights (~38 MB)
.venv/bin/python download_models.py

# 3. Start FastAPI server + HUD on http://localhost:8000
.venv/bin/python run.py --port 8000

# 4. Run automated Pytest suite
.venv/bin/pytest -v
```
