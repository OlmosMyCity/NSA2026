"""Unit tests for the real-time Facial Identity & Biometric Enrollment Engine."""

import numpy as np
from fastapi.testclient import TestClient

from src.api.app import app
from src.pipeline import AstronautBiometricsPipeline
from src.schemas import EnrolledCrewProfile
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator


def test_extract_and_match_astronaut_identity() -> None:
    pipeline = AstronautBiometricsPipeline()
    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=70.0, state="nominal"))
    frame = gen.next_frame(0.5)

    # 1. Extract biometric embedding from frame
    extracted = pipeline.extract_biometric(frame)
    assert extracted.face_detected is True
    assert len(extracted.embedding) == 128
    assert extracted.quality_score > 0.0
    assert extracted.bbox_norm is not None and len(extracted.bbox_norm) == 4

    # 2. Without gallery enrolled, status is empty_gallery and recognized is False
    tel_empty = pipeline.process_frame(frame, timestamp=1.0)
    assert tel_empty.identity.recognized is False
    assert tel_empty.identity.status == "empty_gallery"
    assert tel_empty.identity.bbox_norm is not None

    # 3. Enroll Christina Koch with extracted vector
    enrolled = pipeline.set_gallery(
        [
            EnrolledCrewProfile(
                astronaut_id="astro-03",
                astronaut_name="Christina Koch",
                role="Mission Specialist",
                embeddings=[extracted.embedding],
            )
        ]
    )
    assert enrolled == 1

    # 4. Next frame of same subject should match Christina Koch with high confidence
    frame_next = gen.next_frame(0.6)
    tel_matched = pipeline.process_frame(frame_next, timestamp=1.1)
    assert tel_matched.identity.recognized is True
    assert tel_matched.identity.astronaut_id == "astro-03"
    assert tel_matched.identity.astronaut_name == "Christina Koch"
    assert tel_matched.identity.confidence >= 75.0

    # 5. Orthogonal embedding in gallery should NOT match (unknown subject -> strict lock)
    ortho = [-x for x in extracted.embedding]
    pipeline.set_gallery(
        [
            EnrolledCrewProfile(
                astronaut_id="astro-99",
                astronaut_name="Other Subject",
                embeddings=[ortho],
            )
        ]
    )
    tel_unknown = pipeline.process_frame(frame_next, timestamp=1.2)
    assert tel_unknown.identity.recognized is False
    assert tel_unknown.identity.status == "unknown"


def test_biometrics_api_endpoints() -> None:
    client = TestClient(app)
    gen = SyntheticAstronautGenerator()
    frame = gen.next_frame(0.2)

    import cv2

    ok, buf = cv2.imencode(".jpg", frame)
    assert ok

    res_extract = client.post(
        "/api/biometrics/extract",
        files={"file": ("face.jpg", buf.tobytes(), "image/jpeg")},
    )
    assert res_extract.status_code == 200
    body = res_extract.json()
    assert body["face_detected"] is True
    assert len(body["embedding"]) == 128

    res_gallery = client.post(
        "/api/biometrics/gallery",
        json={
            "profiles": [
                {
                    "astronaut_id": "astro-01",
                    "astronaut_name": "Reid Wiseman",
                    "embeddings": [body["embedding"]],
                }
            ]
        },
    )
    assert res_gallery.status_code == 200
    assert res_gallery.json()["enrolled_count"] == 1
