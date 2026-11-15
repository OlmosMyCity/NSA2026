"""Pydantic schemas for Astronaut Vitals telemetry and API responses."""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CameraMode(str, Enum):
    RGB_POS = "rgb_pos"          # Standard RGB camera using Plane-Orthogonal-to-Skin (POS)
    RGB_CHROM = "rgb_chrom"      # Standard RGB camera using Chrominance (CHROM)
    NIR_IR = "nir_ir"            # Near-Infrared / Night-Vision / Thermal monochrome camera


class MonitoringContext(str, Enum):
    CABIN_ACTIVE = "cabin_active"  # Active mission duty (drowsiness, stress, mood, BPM)
    SLEEP_POD = "sleep_pod"        # Sleep quarter monitoring (actigraphy, sleep quality, BPM/HRV)


class MoodMetrics(BaseModel):
    dominant_mood: str = Field(..., description="Operational astronaut psychological state")
    raw_emotion: str = Field(..., description="Primary facial emotion class")
    emotion_probabilities: Dict[str, float] = Field(default_factory=dict)
    mood_valence: float = Field(..., ge=-1.0, le=1.0, description="Emotional valence (-1 negative to +1 positive)")
    stress_index: float = Field(..., ge=0.0, le=100.0, description="Estimated facial/autonomic tension (0-100)")
    alertness_score: float = Field(..., ge=0.0, le=100.0, description="Cognitive alertness estimate (0-100)")
    brow_furrow_score: float = Field(0.0, ge=0.0, le=1.0)
    smile_score: float = Field(0.0, ge=0.0, le=1.0)
    model_backend: str = Field("onnx+au", description="Inference backend used")


class SleepMetrics(BaseModel):
    sleep_quality_score: float = Field(..., ge=0.0, le=100.0, description="Composite sleep/rest quality score (0-100)")
    fatigue_level: str = Field(..., description="Nominal, Mild Fatigue, High Drowsiness, Microsleep Alert, or Sleeping")
    sleep_stage_estimate: str = Field(..., description="Awake, Light/Restless Sleep, or Deep Rest")
    ear_left: float = Field(..., description="Left Eye Aspect Ratio")
    ear_right: float = Field(..., description="Right Eye Aspect Ratio")
    ear_mean: float = Field(..., description="Average Eye Aspect Ratio")
    mar: float = Field(..., description="Mouth Aspect Ratio (yawn indicator)")
    perclos: float = Field(..., ge=0.0, le=100.0, description="Percentage of eyelid closure over time (0-100%)")
    blink_rate_per_min: float = Field(0.0, ge=0.0)
    yawn_count: int = Field(0, ge=0)
    microsleep_detected: bool = Field(False)
    head_pitch_deg: float = Field(0.0, description="Head pitch angle in degrees (+ downward nod)")
    head_yaw_deg: float = Field(0.0, description="Head yaw angle in degrees")
    head_roll_deg: float = Field(0.0, description="Head roll angle in degrees")
    movement_index: float = Field(0.0, ge=0.0, le=100.0, description="Video actigraphy restlessness index (0-100)")
    restlessness_events: int = Field(0, ge=0)


class HeartRateMetrics(BaseModel):
    bpm: float = Field(..., ge=0.0, description="Estimated Heart Rate in Beats Per Minute")
    hrv_rmssd_ms: float = Field(0.0, ge=0.0, description="Heart Rate Variability (RMSSD in milliseconds)")
    hrv_sdnn_ms: float = Field(0.0, ge=0.0, description="Heart Rate Variability (SDNN in milliseconds)")
    respiration_rpm: float = Field(0.0, ge=0.0, description="Estimated Respiration Rate (breaths per minute)")
    signal_quality: float = Field(..., ge=0.0, le=100.0, description="rPPG Signal Quality Index (0-100%)")
    camera_mode: CameraMode = Field(CameraMode.RGB_POS)
    buffer_fill_pct: float = Field(..., ge=0.0, le=100.0, description="Percentage of temporal window filled")
    bvp_waveform: List[float] = Field(default_factory=list, description="Recent filtered Blood Volume Pulse samples")
    spectrum_freqs_bpm: List[float] = Field(default_factory=list, description="Power spectrum frequencies in BPM")
    spectrum_power: List[float] = Field(default_factory=list, description="Normalized spectral power")
    status: str = Field("calibrating", description="calibrating, locked, low_signal, or no_face")


class IdentityMetrics(BaseModel):
    recognized: bool = Field(False, description="True if face matches an enrolled crew member")
    astronaut_id: Optional[str] = Field(None, description="Matched astronaut ID")
    astronaut_name: Optional[str] = Field(None, description="Matched astronaut full name")
    confidence: float = Field(0.0, ge=0.0, le=100.0, description="Match confidence percentage (0-100)")
    similarity: float = Field(0.0, ge=0.0, le=1.0, description="Raw cosine similarity")
    enrolled_count: int = Field(0, ge=0, description="Number of crew members with enrolled biometrics")
    status: str = Field("no_face", description="recognized, unknown, empty_gallery, or no_face")
    bbox_norm: Optional[List[float]] = Field(
        None, description="Normalized [x, y, w, h] in 0..1 for 60fps YOLO overlay"
    )


class EnrolledCrewProfile(BaseModel):
    astronaut_id: str
    astronaut_name: str
    role: Optional[str] = None
    embeddings: List[List[float]] = Field(default_factory=list)


class BiometricExtractResponse(BaseModel):
    face_detected: bool
    embedding: List[float] = Field(default_factory=list)
    quality_score: float = Field(0.0, ge=0.0, le=100.0)
    bbox_norm: Optional[List[float]] = None
    backend: str = "hybrid_128d"


class AstronautTelemetryFrame(BaseModel):
    timestamp: float
    frame_index: int
    face_detected: bool
    fps: float
    camera_mode: CameraMode
    context: MonitoringContext
    overall_health_index: float = Field(..., ge=0.0, le=100.0)
    alerts: List[str] = Field(default_factory=list)
    mood: MoodMetrics
    sleep: SleepMetrics
    heart_rate: HeartRateMetrics
    identity: IdentityMetrics = Field(default_factory=IdentityMetrics)
    annotated_frame_jpeg_b64: Optional[str] = Field(
        None, description="Optional Base64-encoded JPEG frame with biometric HUD overlay"
    )
