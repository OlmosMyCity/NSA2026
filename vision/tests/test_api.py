"""Integration tests for the FastAPI REST and WebSocket endpoints."""

import tempfile
import cv2
from fastapi.testclient import TestClient

import pytest
from starlette.websockets import WebSocketDisconnect

from src.api.app import MAX_FRAME_BYTES, app
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


def test_frame_upload_enforces_size_limit() -> None:
    oversized = b"\xff\xd8\xff" + b"0" * MAX_FRAME_BYTES
    res = client.post(
        "/api/analyze/frame",
        files={"file": ("huge.jpg", oversized, "image/jpeg")},
    )
    assert res.status_code == 413


def test_video_upload_rejects_bad_extension_and_unbounded_frames() -> None:
    res_ext = client.post(
        "/api/analyze/video",
        files={"file": ("payload.sh", b"echo hi", "application/octet-stream")},
    )
    assert res_ext.status_code == 400

    res_frames = client.post(
        "/api/analyze/video",
        files={"file": ("clip.mp4", b"0000", "video/mp4")},
        data={"max_frames": "999999"},
    )
    assert res_frames.status_code == 422


def test_service_token_guards_endpoints_and_websocket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "vision-secret")

    res_unauth = client.post("/api/reset")
    assert res_unauth.status_code == 401

    res_auth = client.post("/api/reset", headers={"X-Service-Token": "vision-secret"})
    assert res_auth.status_code == 200

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/telemetry"):
            pass

    with client.websocket_connect("/ws/telemetry", headers={"X-Service-Token": "vision-secret"}) as ws:
        ws.send_json({"type": "reset"})
        ack = ws.receive_json()
        assert ack["status"] == "reset"


def test_cors_blocks_disallowed_origin_and_credentials() -> None:
    res = client.options(
        "/api/health",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in {k.lower(): v for k, v in res.headers.items()}
