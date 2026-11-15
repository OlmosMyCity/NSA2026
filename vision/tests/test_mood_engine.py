"""Unit tests for the Astronaut Mood & Psychological Stress Engine (ONNX FERPlus + Action Units)."""

from src.pipeline import AstronautBiometricsPipeline
from src.vision.synthetic_stream import SimulationConfig, SyntheticAstronautGenerator


def test_mood_engine_distinguishes_positive_vs_stressed() -> None:
    """Verify MoodEngine differentiates happy/positive state from stressed/high-tension state."""
    gen_happy = SyntheticAstronautGenerator(SimulationConfig(state="happy", target_bpm=68.0))
    gen_stress = SyntheticAstronautGenerator(SimulationConfig(state="stressed", target_bpm=112.0))
    pipe_happy = AstronautBiometricsPipeline()
    pipe_stress = AstronautBiometricsPipeline()

    fps = 30.0
    tel_happy = None
    tel_stress = None
    for i in range(int(2.0 * fps)):
        ts = i / fps
        tel_happy = pipe_happy.process_frame(gen_happy.next_frame(ts), timestamp=ts)
        tel_stress = pipe_stress.process_frame(gen_stress.next_frame(ts), timestamp=ts)

    assert tel_happy is not None and tel_stress is not None
    assert tel_stress.mood.stress_index > tel_happy.mood.stress_index
    assert tel_happy.mood.mood_valence > tel_stress.mood.mood_valence
    assert "onnx" in tel_happy.mood.model_backend or "au" in tel_happy.mood.model_backend
    assert abs(sum(tel_happy.mood.emotion_probabilities.values()) - 1.0) < 0.15
