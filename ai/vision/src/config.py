"""Configuration constants for the Astronaut Vitals biometric subsystem."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Lightweight Open-Source Models
FERPLUS_ONNX_PATH = MODELS_DIR / "emotion-ferplus-8.onnx"
FERPLUS_ONNX_URL = (
    "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/"
    "emotion_ferplus/model/emotion-ferplus-8.onnx"
)
MEDIAPIPE_FACE_LANDMARKER_PATH = MODELS_DIR / "face_landmarker.task"
MEDIAPIPE_FACE_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
SFACE_ONNX_PATH = MODELS_DIR / "face_recognition_sface_2021dec.onnx"
SFACE_ONNX_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

# Face Identity Recognition Configuration
FACE_EMBEDDING_DIM: int = 128
FACE_MATCH_THRESHOLD: float = 0.56
FACE_SMOOTHING_WINDOW: int = 5

# rPPG Heart Rate & HRV Configuration
RPPG_BUFFER_SECONDS: float = 12.0
RPPG_MIN_SECONDS_FOR_ESTIMATE: float = 3.5
RPPG_DEFAULT_FPS: float = 30.0
RPPG_BANDPASS_LOW_HZ: float = 0.75   # 45 BPM
RPPG_BANDPASS_HIGH_HZ: float = 3.00  # 180 BPM
RPPG_RESP_LOW_HZ: float = 0.15       # 9 RPM
RPPG_RESP_HIGH_HZ: float = 0.45      # 27 RPM

# Sleep & Drowsiness Configuration
EAR_BLINK_THRESHOLD: float = 0.21
MAR_YAWN_THRESHOLD: float = 0.55
MICROSLEEP_SECONDS_THRESHOLD: float = 1.5
HEAD_NOD_PITCH_THRESHOLD_DEG: float = 18.0
PERCLOS_WINDOW_SECONDS: float = 30.0

# Mood & Stress Smoothing
MOOD_EMA_ALPHA: float = 0.25
