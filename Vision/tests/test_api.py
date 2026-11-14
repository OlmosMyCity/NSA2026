"""Integration tests for the FastAPI REST and WebSocket endpoints."""

import tempfile
import cv2
from fastapi.testclient import TestClient

from src.api.app import app
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator

client = TestClient(app)


def test_health_and_dashboard_routes() -> None:
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "OrbVital" in res_root.text

    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    body = res_health.json()
    assert body["status"] == "ok"
    assert body["models"]["ferplus_onnx_loaded"] is True


def test_latest_telemetry_and_single_frame_upload() -> None:
    res_latest = client.get("/api/telemetry/latest")
    assert res_latest.status_code == 200
    data = res_latest.json()
    assert "mood" in data and "sleep" in data and "heart_rate" in data

    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=75.0, state="nominal"))
    frame = gen.next_frame(1.0)
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok

    res_frame = client.post(
        "/api/analyze/frame",
        files={"file": ("frame.jpg", buf.tobytes(), "image/jpeg")},
        data={"camera_mode": "rgb_pos", "context": "cabin_active", "include_hud": "true"},
    )
    assert res_frame.status_code == 200
    f_json = res_frame.json()
    assert f_json["face_detected"] is True
    assert f_json["annotated_frame_jpeg_b64"] is not None


def test_video_upload_endpoint() -> None:
    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=78.0, state="nominal"))
    with tempfile.NamedTemporaryFile(suffix=".avi", delete=True) as tmp:
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(tmp.name, fourcc, 30.0, (640, 480))
        for i in range(120):
            writer.write(gen.next_frame(i / 30.0))
        writer.release()

        with open(tmp.name, "rb") as f:
            res = client.post(
                "/api/analyze/video",
                files={"file": ("test_clip.avi", f.read(), "video/x-msvideo")},
                data={"camera_mode": "rgb_pos", "context": "cabin_active"},
            )
        assert res.status_code == 200
        out = res.json()
        assert out["frames_processed"] == 120
        assert out["summary"]["mean_bpm"] > 0.0


def test_websocket_telemetry_stream() -> None:
    with client.websocket_connect("/ws/telemetry") as ws:
        ws.send_json(
            {
                "type": "tick",
                "camera_mode": "nir_ir",
                "context": "sleep_pod",
                "sim_bpm": 68,
                "sim_state": "sleeping_calm",
            }
        )
        msg = ws.receive_json()
        assert msg["face_detected"] is True
        assert msg["camera_mode"] == "nir_ir"
        assert msg["context"] == "sleep_pod"
        assert msg["annotated_frame_jpeg_b64"] is not None
