"""Astronaut Mood, Emotion, and Psychological Stress Engine (ONNX FERPlus + Action Units)."""

from typing import Dict, Optional
import numpy as np

from src.config import FERPLUS_ONNX_PATH, MOOD_EMA_ALPHA
from src.schemas import MoodMetrics

FERPLUS_LABELS = [
    "neutral",
    "happiness",
    "surprise",
    "sadness",
    "anger",
    "disgust",
    "fear",
    "contempt",
]


def _softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x))
    return e_x / np.sum(e_x)


_SHARED_ORT_SESSION = None
_SHARED_INPUT_NAME: Optional[str] = None
_SHARED_BACKEND_NAME: Optional[str] = None


class MoodEngine:
    """Combines lightweight ONNX FERPlus inference with geometric Action Units & HRV feedback."""

    def __init__(self, alpha: float = MOOD_EMA_ALPHA) -> None:
        global _SHARED_ORT_SESSION, _SHARED_INPUT_NAME, _SHARED_BACKEND_NAME
        self.alpha = alpha
        if _SHARED_BACKEND_NAME is None:
            self._init_shared_onnx()
        self._ort_session = _SHARED_ORT_SESSION
        self._input_name = _SHARED_INPUT_NAME
        self._backend_name = _SHARED_BACKEND_NAME or "au_geometric"
        self._ema_probs: Optional[np.ndarray] = None

    @staticmethod
    def _init_shared_onnx() -> None:
        global _SHARED_ORT_SESSION, _SHARED_INPUT_NAME, _SHARED_BACKEND_NAME
        if not FERPLUS_ONNX_PATH.exists() or FERPLUS_ONNX_PATH.stat().st_size < 1024:
            _SHARED_BACKEND_NAME = "au_geometric"
            return
        try:
            import onnxruntime as ort

            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 2
            _SHARED_ORT_SESSION = ort.InferenceSession(
                str(FERPLUS_ONNX_PATH),
                sess_options=sess_options,
                providers=["CPUExecutionProvider"],
            )
            _SHARED_INPUT_NAME = _SHARED_ORT_SESSION.get_inputs()[0].name
            _SHARED_BACKEND_NAME = "onnx_ferplus+au"
        except Exception:
            _SHARED_ORT_SESSION = None
            _SHARED_BACKEND_NAME = "au_geometric"

    def reset(self) -> None:
        self._ema_probs = None

    def update(
        self,
        face_detected: bool,
        face_crop_gray: Optional[np.ndarray],
        ear_mean: float,
        mar: float,
        brow_furrow: float,
        smile_ratio: float,
        perclos: float = 0.0,
        bpm: float = 0.0,
    ) -> MoodMetrics:
        if not face_detected:
            return MoodMetrics(
                dominant_mood="No Subject Detected",
                raw_emotion="neutral",
                emotion_probabilities={k: 0.0 for k in FERPLUS_LABELS[:6]},
                mood_valence=0.0,
                stress_index=0.0,
                alertness_score=0.0,
                brow_furrow_score=0.0,
                smile_score=0.0,
                model_backend=self._backend_name,
            )

        # 1. Compute Geometric Action Unit prior distribution over the 8 FERPlus classes
        au_probs = self._compute_au_probabilities(ear_mean, mar, brow_furrow, smile_ratio)

        # 2. If ONNX FERPlus session is loaded, run inference on 64x64 grayscale crop and fuse
        if self._ort_session is not None and face_crop_gray is not None and face_crop_gray.shape == (64, 64):
            try:
                inp = face_crop_gray.astype(np.float32).reshape(1, 1, 64, 64)
                logits = self._ort_session.run(None, {self._input_name: inp})[0][0]
                onnx_probs = _softmax(np.asarray(logits, dtype=np.float64))
                # Hybrid fusion: 50% ONNX neural appearance + 50% 3D landmark Action Units
                fused_probs = 0.50 * onnx_probs + 0.50 * au_probs
                fused_probs /= np.sum(fused_probs)
            except Exception:
                fused_probs = au_probs
        else:
            fused_probs = au_probs

        # 3. Apply Exponential Moving Average (EMA) smoothing
        if self._ema_probs is None:
            self._ema_probs = fused_probs
        else:
            self._ema_probs = self.alpha * fused_probs + (1.0 - self.alpha) * self._ema_probs
            self._ema_probs /= np.sum(self._ema_probs)

        probs = self._ema_probs
        prob_dict: Dict[str, float] = {
            FERPLUS_LABELS[i]: round(float(probs[i]), 3) for i in range(6)
        }

        top_idx = int(np.argmax(probs[:6]))
        raw_emotion = FERPLUS_LABELS[top_idx]

        # 4. Compute Astronaut Operational Psychological Metrics
        # Valence: positive for happiness/calm, negative for anger/fear/sadness/stress
        valence = (
            1.0 * float(probs[1])
            + 0.25 * float(probs[0])
            + 0.15 * float(probs[2])
            - 0.75 * float(probs[3])
            - 0.90 * float(probs[4])
            - 0.85 * float(probs[6])
        )
        valence = float(np.clip(valence, -1.0, 1.0))

        # Stress Index (0-100): driven by brow furrow, anger/fear/contempt probabilities, and elevated HR
        hr_stress_contrib = max(0.0, (bpm - 85.0) * 0.6) if bpm > 0.0 else 0.0
        stress_raw = (
            brow_furrow * 48.0
            + (float(probs[4]) + float(probs[6]) + float(probs[5])) * 55.0
            + hr_stress_contrib
            - float(probs[1]) * 15.0
        )
        stress_index = float(np.clip(stress_raw, 5.0, 100.0))

        # Alertness Score (0-100): inverse of PERCLOS and eye closure, boosted by open eyes
        ear_factor = float(np.clip((ear_mean - 0.15) / 0.16, 0.0, 1.0))
        alertness_score = float(np.clip(ear_factor * 75.0 + (100.0 - perclos) * 0.25, 0.0, 100.0))

        # Operational astronaut state classification
        if perclos >= 35.0 or ear_mean < 0.19:
            dominant_mood = "Fatigued / Drowsy"
        elif stress_index >= 58.0 or brow_furrow >= 0.55:
            dominant_mood = "Stressed / High Tension"
        elif float(probs[1]) >= 0.34 or smile_ratio >= 0.48:
            dominant_mood = "Positive / Engaged"
        elif float(probs[3]) >= 0.35:
            dominant_mood = "Low Morale / Sad"
        else:
            dominant_mood = "Calm / Focused"

        return MoodMetrics(
            dominant_mood=dominant_mood,
            raw_emotion=raw_emotion,
            emotion_probabilities=prob_dict,
            mood_valence=round(valence, 2),
            stress_index=round(stress_index, 1),
            alertness_score=round(alertness_score, 1),
            brow_furrow_score=round(brow_furrow, 2),
            smile_score=round(smile_ratio, 2),
            model_backend=self._backend_name,
        )

    @staticmethod
    def _compute_au_probabilities(
        ear_mean: float, mar: float, brow_furrow: float, smile_ratio: float
    ) -> np.ndarray:
        """Maps geometric facial Action Units to an 8-class probability distribution."""
        scores = np.zeros(8, dtype=np.float64)
        # 0: neutral
        scores[0] = max(0.15, 1.0 - max(smile_ratio, brow_furrow, max(0.0, mar - 0.35)))
        # 1: happiness
        scores[1] = smile_ratio * 1.65
        # 2: surprise (wide eyes + open mouth)
        scores[2] = max(0.0, (ear_mean - 0.29) * 3.0) + max(0.0, (mar - 0.45) * 1.4)
        # 3: sadness (drooping eyes + low smile + slight brow)
        scores[3] = max(0.0, (0.24 - ear_mean) * 2.2) * (1.0 - smile_ratio)
        # 4: anger / tension (strong brow furrow + tight mouth)
        scores[4] = brow_furrow * 1.75 * max(0.2, 1.0 - smile_ratio)
        # 5: disgust
        scores[5] = brow_furrow * 0.45
        # 6: fear
        scores[6] = max(0.0, (ear_mean - 0.30) * 2.0) * brow_furrow
        # 7: contempt
        scores[7] = 0.05

        total = float(np.sum(scores))
        return scores / total if total > 1e-6 else np.array([1, 0, 0, 0, 0, 0, 0, 0], dtype=np.float64)
