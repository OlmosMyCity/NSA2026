# Orbvital Vision — Contactless Biometrics Microservice

FastAPI computer-vision service for **Orbvital** that turns a standard RGB camera or uploaded video frames into contactless astronaut biometric telemetry and biometric identity embeddings.

> Documentation index: [Root README](../README.md) · [Frontend README](../frontend/README.md) · [Backend README](../backend/README.md)

---

## Computer Vision Pipeline (`src/`)

- **Face Tracking & Synthetic Fallback (`src/vision/`)**: `face_tracker.py` (MediaPipe Face Landmarker) + `synthetic_stream.py` for offline/camera-free development.
- **Biometric Inference Engines (`src/engines/`)**:
  - `identity_engine.py`: Extracts facial landmark embeddings and matches crew profiles without contact.
  - `rppg_engine.py`: Remote photoplethysmography (rPPG) heart-rate estimation via chrominance/signal filtering (`numpy`, `scipy`).
  - `mood_engine.py`: Facial expression & stress classification with `emotion-ferplus-8.onnx` (`onnxruntime`).
  - `sleep_engine.py`: Eye-aspect-ratio & PERCLOS fatigue/drowsiness tracking.
- **Orchestration & API (`src/pipeline.py`, `src/api/app.py`, `src/schemas.py`, `src/config.py`)**: Combines per-frame inference into structured telemetry streams over REST and WebSockets.

```text
RGB Frame / Webcam ──▶ face_tracker (MediaPipe)
                           ├──▶ identity_engine  (Crew ID embedding match)
                           ├──▶ rppg_engine      (Contactless BPM)
                           ├──▶ mood_engine      (FER+ ONNX mood & stress)
                           └──▶ sleep_engine     (PERCLOS & fatigue state)
                                    └──▶ REST / WS /ws/telemetry ──▶ Frontend (/vision) & Backend (/api/readings/vision-ingest)
```

---

## HTTP & WebSocket Endpoints (`src/api/app.py`)

| Method / Protocol | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Built-in static preview page |
| `GET` | `/api/health` | Service health & loaded model status |
| `POST` | `/api/reset` | Reset rolling rPPG / sleep / identity buffers |
| `GET` | `/api/telemetry/latest` | Latest aggregated telemetry frame |
| `POST` | `/api/telemetry/tick` | Advance synthetic/active telemetry pipeline one step |
| `GET` | `/api/biometrics/gallery` | Inspect enrolled crew biometric embeddings |
| `POST` | `/api/biometrics/extract` | Extract normalized facial embedding from multipart image upload |
| `POST` | `/api/biometrics/extract-json` | Extract normalized facial embedding from JSON base64 payload |
| `POST` | `/api/analyze/frame` | Run full biometric pipeline on a single uploaded image frame |
| `POST` | `/api/analyze/video` | Analyze an uploaded video clip across frames |
| `WS` | `/ws/telemetry` | Real-time bidirectional frame ingest & telemetry stream |

---

## Quickstart & Testing

```bash
cd vision
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_models.py
python run.py
```

By default the server listens on `http://localhost:8000`.

### Tests

Unit tests live under `vision/tests/` (`test_api.py`, `test_identity_engine.py`, `test_mood_engine.py`, `test_rppg_engine.py`, `test_sleep_engine.py`):

```bash
cd vision
pytest
```

> Container deployment configuration is provided in `vision/Dockerfile.vercel` and `vision/vercel.json`.
