"""FastAPI server exposing REST endpoints, WebSocket streaming, and the Mission Control UI."""

import base64
import json
import tempfile
from pathlib import Path
from typing import Any, Dict

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.config import FERPLUS_ONNX_PATH, MEDIAPIPE_FACE_LANDMARKER_PATH
from src.pipeline import AstronautBiometricsPipeline
from src.schemas import AstronautTelemetryFrame, CameraMode, MonitoringContext
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="OrbVital - Astronaut Biometrics & Vitals API",
    description=(
        "Lightweight open-source monitoring of astronaut Mood/Stress, "
        "Sleep Quality/PERCLOS, and Multi-Camera rPPG Heart Rate (BPM/HRV)."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Shared pipeline instance for REST endpoints
global_pipeline = AstronautBiometricsPipeline()
global_simulator = SyntheticAstronautGenerator()
_global_sim_time: float = 0.0


@app.get("/", include_in_schema=False)
async def serve_dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "astronaut_vitals",
        "version": "0.1.0",
        "models": {
            "ferplus_onnx_loaded": FERPLUS_ONNX_PATH.exists(),
            "mediapipe_landmarker_loaded": MEDIAPIPE_FACE_LANDMARKER_PATH.exists(),
            "face_tracker_backend": global_pipeline.face_tracker._mp_mode,
            "mood_backend": global_pipeline.mood_engine._backend_name,
        },
    }


@app.post("/api/reset")
async def reset_pipeline() -> Dict[str, str]:
    global _global_sim_time
    global_pipeline.reset()
    _global_sim_time = 0.0
    return {"status": "reset"}


@app.get("/api/telemetry/latest", response_model=AstronautTelemetryFrame)
async def get_latest_telemetry() -> AstronautTelemetryFrame:
    global _global_sim_time
    if global_pipeline.latest_telemetry is None:
        # Warm up with 1 frame from synthetic simulator so callers always receive valid telemetry
        _global_sim_time += 1.0 / 30.0
        frame = global_simulator.next_frame(_global_sim_time)
        return global_pipeline.process_frame(frame, timestamp=_global_sim_time, include_annotated_frame=False)
    return global_pipeline.latest_telemetry


@app.post("/api/analyze/frame", response_model=AstronautTelemetryFrame)
async def analyze_single_frame(
    file: UploadFile = File(...),
    camera_mode: CameraMode = Form(CameraMode.RGB_POS),
    context: MonitoringContext = Form(MonitoringContext.CABIN_ACTIVE),
    include_hud: bool = Form(False),
) -> AstronautTelemetryFrame:
    raw_bytes = await file.read()
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return global_pipeline.process_frame(
        frame_bgr=frame_bgr,
        camera_mode=camera_mode,
        context=context,
        include_annotated_frame=include_hud,
    )


@app.post("/api/analyze/video")
async def analyze_video_file(
    file: UploadFile = File(...),
    camera_mode: CameraMode = Form(CameraMode.RGB_POS),
    context: MonitoringContext = Form(MonitoringContext.CABIN_ACTIVE),
    max_frames: int = Form(450),
) -> Dict[str, Any]:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty video upload")

    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(raw_bytes)
        tmp.flush()

        cap = cv2.VideoCapture(tmp.name)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not decode video file")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        if fps <= 1.0 or fps > 240.0:
            fps = 30.0

        session_pipeline = AstronautBiometricsPipeline()
        bpms = []
        stress_scores = []
        sleep_scores = []
        mood_counts: Dict[str, int] = {}
        last_telemetry: AstronautTelemetryFrame | None = None
        frame_idx = 0

        while frame_idx < max_frames:
            ret, frame_bgr = cap.read()
            if not ret:
                break
            ts = frame_idx / fps
            tel = session_pipeline.process_frame(
                frame_bgr=frame_bgr,
                timestamp=ts,
                camera_mode=camera_mode,
                context=context,
                include_annotated_frame=False,
            )
            if tel.heart_rate.bpm > 0:
                bpms.append(tel.heart_rate.bpm)
            stress_scores.append(tel.mood.stress_index)
            sleep_scores.append(tel.sleep.sleep_quality_score)
            mood_counts[tel.mood.dominant_mood] = mood_counts.get(tel.mood.dominant_mood, 0) + 1
            last_telemetry = tel
            frame_idx += 1

        cap.release()

    if last_telemetry is None:
        raise HTTPException(status_code=400, detail="No valid frames found in video")

    dominant_session_mood = max(mood_counts.items(), key=lambda kv: kv[1])[0] if mood_counts else "Unknown"
    return {
        "frames_processed": frame_idx,
        "video_fps": round(fps, 2),
        "duration_seconds": round(frame_idx / fps, 2),
        "camera_mode": camera_mode,
        "context": context,
        "summary": {
            "mean_bpm": round(float(np.mean(bpms)), 1) if bpms else 0.0,
            "final_bpm": last_telemetry.heart_rate.bpm,
            "hrv_rmssd_ms": last_telemetry.heart_rate.hrv_rmssd_ms,
            "respiration_rpm": last_telemetry.heart_rate.respiration_rpm,
            "signal_quality": last_telemetry.heart_rate.signal_quality,
            "dominant_mood": dominant_session_mood,
            "mean_stress_index": round(float(np.mean(stress_scores)), 1) if stress_scores else 0.0,
            "mean_sleep_quality_score": round(float(np.mean(sleep_scores)), 1) if sleep_scores else 0.0,
            "final_perclos": last_telemetry.sleep.perclos,
            "yawn_count": last_telemetry.sleep.yawn_count,
            "fatigue_level": last_telemetry.sleep.fatigue_level,
            "sleep_stage_estimate": last_telemetry.sleep.sleep_stage_estimate,
            "overall_health_index": last_telemetry.overall_health_index,
            "alerts": last_telemetry.alerts,
        },
        "final_telemetry": last_telemetry.model_dump(),
    }


def _decode_base64_image(data_uri: str) -> np.ndarray | None:
    if "," in data_uri:
        _, b64_part = data_uri.split(",", 1)
    else:
        b64_part = data_uri
    try:
        raw = base64.b64decode(b64_part)
        arr = np.frombuffer(raw, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


@app.websocket("/ws/telemetry")
async def websocket_telemetry(ws: WebSocket) -> None:
    await ws.accept()
    session_pipeline = AstronautBiometricsPipeline()
    simulator = SyntheticAstronautGenerator(SimulationConfig(target_bpm=72.0, state="nominal"))
    sim_ts = 0.0
    camera_mode = CameraMode.RGB_POS
    context = MonitoringContext.CABIN_ACTIVE

    try:
        while True:
            raw_msg = await ws.receive_text()
            msg = json.loads(raw_msg)
            msg_type = msg.get("type", "tick")

            if "camera_mode" in msg:
                camera_mode = CameraMode(msg["camera_mode"])
            if "context" in msg:
                context = MonitoringContext(msg["context"])

            if msg_type == "reset":
                session_pipeline.reset()
                sim_ts = 0.0
                await ws.send_json({"type": "ack", "status": "reset"})
                continue

            if msg_type == "config":
                simulator.update_config(
                    target_bpm=msg.get("sim_bpm"),
                    state=msg.get("sim_state"),
                    nir_mode=(camera_mode == CameraMode.NIR_IR),
                )
                await ws.send_json({"type": "ack", "status": "configured"})
                continue

            if msg_type == "frame":
                frame_bgr = _decode_base64_image(msg.get("image_b64", ""))
                if frame_bgr is None:
                    await ws.send_json({"type": "error", "detail": "Invalid frame_b64"})
                    continue
                client_ts = float(msg.get("timestamp", sim_ts + (1.0 / 30.0)))
                sim_ts = client_ts
                telemetry = session_pipeline.process_frame(
                    frame_bgr=frame_bgr,
                    timestamp=client_ts,
                    camera_mode=camera_mode,
                    context=context,
                    include_annotated_frame=bool(msg.get("include_hud", True)),
                )
                global_pipeline.latest_telemetry = telemetry
                await ws.send_json(telemetry.model_dump())

            elif msg_type == "tick":
                # Generate next synthetic astronaut frame at 30 FPS step
                simulator.update_config(
                    target_bpm=msg.get("sim_bpm"),
                    state=msg.get("sim_state"),
                    nir_mode=(camera_mode == CameraMode.NIR_IR),
                )
                sim_ts += 1.0 / 30.0
                frame_bgr = simulator.next_frame(sim_ts)
                telemetry = session_pipeline.process_frame(
                    frame_bgr=frame_bgr,
                    timestamp=sim_ts,
                    camera_mode=camera_mode,
                    context=context,
                    include_annotated_frame=True,
                )
                global_pipeline.latest_telemetry = telemetry
                await ws.send_json(telemetry.model_dump())

    except WebSocketDisconnect:
        return
