"""Unit tests for the Multi-Camera rPPG Heart Rate & HRV Engine."""

import numpy as np
from src.engines.rppg_engine import RPPGEngine
from src.pipeline import AstronautBiometricsPipeline
from src.schemas import CameraMode
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator


def test_rppg_pos_rgb_accuracy_72bpm() -> None:
    """Verify POS algorithm recovers 72 BPM within +/- 2.5 BPM on synthetic RGB stream."""
    target_bpm = 72.0
    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=target_bpm, state="nominal", nir_mode=False))
    pipe = AstronautBiometricsPipeline()

    fps = 30.0
    last_hr = None
    for i in range(int(8.0 * fps)):
        ts = i / fps
        frame = gen.next_frame(ts)
        tel = pipe.process_frame(frame, timestamp=ts, camera_mode=CameraMode.RGB_POS)
        last_hr = tel.heart_rate

    assert last_hr is not None
    assert last_hr.status == "locked"
    assert abs(last_hr.bpm - target_bpm) <= 2.5, f"Expected ~{target_bpm} BPM, got {last_hr.bpm}"
    assert last_hr.signal_quality >= 40.0
    assert last_hr.hrv_rmssd_ms > 0.0
    assert len(last_hr.bvp_waveform) >= 60


def test_rppg_chrom_rgb_accuracy_90bpm() -> None:
    """Verify CHROM algorithm recovers 90 BPM within +/- 2.5 BPM."""
    target_bpm = 90.0
    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=target_bpm, state="nominal", nir_mode=False))
    pipe = AstronautBiometricsPipeline()

    fps = 30.0
    last_hr = None
    for i in range(int(8.0 * fps)):
        ts = i / fps
        frame = gen.next_frame(ts)
        tel = pipe.process_frame(frame, timestamp=ts, camera_mode=CameraMode.RGB_CHROM)
        last_hr = tel.heart_rate

    assert last_hr is not None
    assert abs(last_hr.bpm - target_bpm) <= 2.5, f"Expected ~{target_bpm} BPM, got {last_hr.bpm}"


def test_rppg_nir_infrared_camera_accuracy_66bpm() -> None:
    """Verify NIR/Monochrome single-channel rPPG recovers 66 BPM on infrared camera frames."""
    target_bpm = 66.0
    gen = SyntheticAstronautGenerator(SimulationConfig(target_bpm=target_bpm, state="sleeping_calm", nir_mode=True))
    pipe = AstronautBiometricsPipeline()

    fps = 30.0
    last_hr = None
    for i in range(int(8.0 * fps)):
        ts = i / fps
        frame = gen.next_frame(ts)
        tel = pipe.process_frame(frame, timestamp=ts, camera_mode=CameraMode.NIR_IR)
        last_hr = tel.heart_rate

    assert last_hr is not None
    assert last_hr.camera_mode == CameraMode.NIR_IR
    assert abs(last_hr.bpm - target_bpm) <= 2.5, f"Expected ~{target_bpm} BPM in NIR mode, got {last_hr.bpm}"
    assert last_hr.signal_quality >= 40.0
