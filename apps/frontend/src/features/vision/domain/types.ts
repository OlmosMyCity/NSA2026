export type CameraMode = 'rgb_pos' | 'rgb_chrom' | 'nir_ir';
export type MonitoringContext = 'cabin_active' | 'sleep_pod';
export type VisionSource = 'simulator' | 'webcam';
export type SimState = 'nominal' | 'stressed' | 'drowsy' | 'sleeping_deep';

export interface MoodMetrics {
  dominant_mood: string;
  raw_emotion: string;
  emotion_probabilities: Record<string, number>;
  mood_valence: number;
  stress_index: number;
  alertness_score: number;
  brow_furrow_score: number;
  smile_score: number;
  model_backend: string;
}

export interface SleepMetrics {
  sleep_quality_score: number;
  fatigue_level: string;
  sleep_stage_estimate: string;
  ear_left: number;
  ear_right: number;
  ear_mean: number;
  mar: number;
  perclos: number;
  blink_rate_per_min: number;
  yawn_count: number;
  microsleep_detected: boolean;
  head_pitch_deg: number;
  head_yaw_deg: number;
  head_roll_deg: number;
  movement_index: number;
  restlessness_events: number;
}

export interface HeartRateMetrics {
  bpm: number;
  hrv_rmssd_ms: number;
  hrv_sdnn_ms: number;
  respiration_rpm: number;
  signal_quality: number;
  camera_mode: CameraMode;
  buffer_fill_pct: number;
  bvp_waveform: number[];
  spectrum_freqs_bpm: number[];
  spectrum_power: number[];
  status: string;
}

export interface AstronautTelemetryFrame {
  timestamp: number;
  frame_index: number;
  face_detected: boolean;
  fps: number;
  camera_mode: CameraMode;
  context: MonitoringContext;
  overall_health_index: number;
  alerts: string[];
  mood: MoodMetrics;
  sleep: SleepMetrics;
  heart_rate: HeartRateMetrics;
  annotated_frame_jpeg_b64?: string | null;
}

export interface VisionHealthResponse {
  status: string;
  service: string;
  version: string;
  models: {
    ferplus_onnx_loaded: boolean;
    mediapipe_landmarker_loaded: boolean;
    face_tracker_backend: string;
    mood_backend: string;
  };
}

export interface VisionIngestResponse {
  reading: {
    id: string;
    astronautId: string;
    heartRateBpm: number;
    status: 'OK' | 'WARNING' | 'CRITICAL';
    mood: number;
    sleepHours: number;
    takenAt: string;
  };
  incidentsTriggered: number;
  derivedVitals: {
    heartRateBpm: number;
    mood: number;
    sleepHours: number;
  };
}
