"""Unit tests for the Sleep Quality, PERCLOS, Drowsiness, and Video Actigraphy Engine."""

from src.pipeline import AstronautBiometricsPipeline
from src.schemas import CameraMode, MonitoringContext
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator


def test_cabin_drowsiness_perclos_and_yawn_detection() -> None:
    """Verify that a drowsy astronaut triggers elevated PERCLOS, yawning, and reduced readiness score."""
    gen_nominal = SyntheticAstronautGenerator(SimulationConfig(state="nominal"))
    gen_drowsy = SyntheticAstronautGenerator(SimulationConfig(state="drowsy"))
    pipe_nominal = AstronautBiometricsPipeline()
    pipe_drowsy = AstronautBiometricsPipeline()

    fps = 30.0
    tel_nom = None
    tel_drw = None
    for i in range(int(5.0 * fps)):
        ts = i / fps
        tel_nom = pipe_nominal.process_frame(
            gen_nominal.next_frame(ts), timestamp=ts, context=MonitoringContext.CABIN_ACTIVE
        )
        tel_drw = pipe_drowsy.process_frame(
            gen_drowsy.next_frame(ts), timestamp=ts, context=MonitoringContext.CABIN_ACTIVE
        )

    assert tel_nom is not None and tel_drw is not None
    assert tel_drw.sleep.perclos > tel_nom.sleep.perclos + 30.0
    assert tel_drw.sleep.yawn_count >= 1
    assert tel_drw.sleep.sleep_quality_score < tel_nom.sleep.sleep_quality_score
    assert tel_drw.sleep.fatigue_level in ("High Drowsiness", "Microsleep Alert", "Mild Fatigue")


def test_sleep_pod_calm_vs_restless_actigraphy() -> None:
    """Verify Sleep Pod mode distinguishes Deep Rest from Light/Restless Sleep via video actigraphy."""
    gen_calm = SyntheticAstronautGenerator(SimulationConfig(state="sleeping_calm", nir_mode=True))
    gen_restless = SyntheticAstronautGenerator(SimulationConfig(state="sleeping_restless", nir_mode=True))
    pipe_calm = AstronautBiometricsPipeline()
    pipe_restless = AstronautBiometricsPipeline()

    fps = 30.0
    tel_calm = None
    tel_restless = None
    for i in range(int(4.5 * fps)):
        ts = i / fps
        tel_calm = pipe_calm.process_frame(
            gen_calm.next_frame(ts),
            timestamp=ts,
            camera_mode=CameraMode.NIR_IR,
            context=MonitoringContext.SLEEP_POD,
        )
        tel_restless = pipe_restless.process_frame(
            gen_restless.next_frame(ts),
            timestamp=ts,
            camera_mode=CameraMode.NIR_IR,
            context=MonitoringContext.SLEEP_POD,
        )

    assert tel_calm is not None and tel_restless is not None
    assert tel_calm.sleep.sleep_stage_estimate == "Deep Rest"
    assert tel_restless.sleep.movement_index > tel_calm.sleep.movement_index
    assert tel_calm.sleep.sleep_quality_score > tel_restless.sleep.sleep_quality_score
