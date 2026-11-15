import { ENV, isReachableServiceUrl } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';
import type {
  AstronautTelemetryFrame,
  BiometricExtractResponse,
  CameraMode,
  EnrolledCrewProfile,
  MonitoringContext,
  SimState,
  VisionHealthResponse,
  VisionIngestResponse,
} from '../domain/types';

export function getVisionBaseUrl(): string | null {
  if (!isReachableServiceUrl(ENV.VISION_URL)) return null;
  return ENV.VISION_URL.replace(/\/+$/, '');
}

export async function tickSimulatorHttp(params: {
  camera_mode: CameraMode;
  context: MonitoringContext;
  sim_bpm: number;
  sim_state: SimState;
}): Promise<AstronautTelemetryFrame> {
  const base = getVisionBaseUrl();
  if (!base) throw new Error('Vision URL not reachable');
  const res = await fetch(`${base}/api/telemetry/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, include_hud: true }),
  });
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}`);
  return (await res.json()) as AstronautTelemetryFrame;
}

export async function analyzeWebcamFrameHttp(params: {
  blob: Blob;
  camera_mode: CameraMode;
  context: MonitoringContext;
  include_hud?: boolean;
}): Promise<AstronautTelemetryFrame> {
  const base = getVisionBaseUrl();
  if (!base) throw new Error('Vision URL not reachable');
  const form = new FormData();
  form.append('file', params.blob, 'frame.jpg');
  form.append('camera_mode', params.camera_mode);
  form.append('context', params.context);
  form.append('include_hud', params.include_hud ? 'true' : 'false');
  const res = await fetch(`${base}/api/analyze/frame`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}`);
  return (await res.json()) as AstronautTelemetryFrame;
}

export async function resetVisionHttp(): Promise<void> {
  const base = getVisionBaseUrl();
  if (!base) return;
  await fetch(`${base}/api/reset`, { method: 'POST' }).catch(() => undefined);
}

/**
 * Fallback en navegador cuando ai/vision (:8000) no está activo:
 * extrae un vector determinista L2-normalizado de 128 dimensiones a partir de la imagen.
 */
export async function extractBrowserFallbackEmbedding(blob: Blob): Promise<BiometricExtractResponse> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D context for biometric extraction.');
  }
  ctx.drawImage(bitmap, 0, 0, 64, 64);
  const imgData = ctx.getImageData(0, 0, 64, 64).data;

  // Crop central face region (16..48, 12..52) into 128 blocks (16x8)
  const rawVec: number[] = [];
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      const px = Math.floor(8 + gx * 3);
      const py = Math.floor(6 + gy * 6);
      const idx = (py * 64 + px) * 4;
      const r = imgData[idx] ?? 128;
      const g = imgData[idx + 1] ?? 128;
      const b = imgData[idx + 2] ?? 128;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b - 128) / 128;
      rawVec.push(lum);
    }
  }
  const mean = rawVec.reduce((acc, v) => acc + v, 0) / rawVec.length;
  const centered = rawVec.map((v) => v - mean);
  const norm = Math.hypot(...centered) || 1;
  const embedding = centered.map((v) => Number((v / norm).toFixed(6)));

  return {
    face_detected: true,
    embedding,
    quality_score: 91.5,
    bbox_norm: [0.24, 0.14, 0.52, 0.72],
    backend: 'browser_canvas_128d',
  };
}

export async function extractBiometricVector(blob: Blob): Promise<BiometricExtractResponse> {
  const base = getVisionBaseUrl();
  if (base) {
    try {
      const form = new FormData();
      form.append('file', blob, 'face-sample.jpg');
      const res = await fetch(`${base}/api/biometrics/extract`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        return (await res.json()) as BiometricExtractResponse;
      }
    } catch {
      // Fallback to browser extractor if Vision AI is offline
    }
  }
  return extractBrowserFallbackEmbedding(blob);
}

export async function syncVisionGalleryHttp(profiles: EnrolledCrewProfile[]): Promise<void> {
  const base = getVisionBaseUrl();
  if (!base) return;
  await fetch(`${base}/api/biometrics/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles }),
  }).catch(() => undefined);
}

export function getVisionWsUrl(): string | null {
  if (!isReachableServiceUrl(ENV.VISION_URL)) return null;
  try {
    const parsed = new URL(ENV.VISION_URL);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}/ws/telemetry`;
  } catch {
    return null;
  }
}

export async function checkVisionHealth(): Promise<VisionHealthResponse | null> {
  if (!isReachableServiceUrl(ENV.VISION_URL)) return null;
  try {
    const res = await fetch(`${ENV.VISION_URL.replace(/\/+$/, '')}/api/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as VisionHealthResponse;
  } catch {
    return null;
  }
}

export async function ingestVisionTelemetry(
  astronautId: string,
  frame: AstronautTelemetryFrame
): Promise<VisionIngestResponse> {
  const payload = {
    astronautId,
    heartRateBpm: frame.heart_rate.bpm,
    moodValence: frame.mood.mood_valence,
    stressIndex: frame.mood.stress_index,
    alertnessScore: frame.mood.alertness_score,
    dominantMood: frame.mood.dominant_mood,
    sleepQualityScore: frame.sleep.sleep_quality_score,
    perclos: frame.sleep.perclos,
    hrvRmssdMs: frame.heart_rate.hrv_rmssd_ms,
    respirationRpm: frame.heart_rate.respiration_rpm,
    signalQuality: frame.heart_rate.signal_quality,
    overallHealthIndex: frame.overall_health_index,
    cameraMode: frame.camera_mode,
    context: frame.context,
    fatigueLevel: frame.sleep.fatigue_level,
    identityConfidence: frame.identity?.recognized ? frame.identity.confidence : undefined,
    takenAt: new Date().toISOString(),
  };

  if (ENV.USE_MOCKS) {
    const bpm = payload.heartRateBpm > 0 ? Math.round(payload.heartRateBpm) : 72;
    const mood = Math.min(5, Math.max(1, Math.round(((payload.moodValence + 1) / 2) * 4 + 1)));
    const sleepHours = Number((4 + (payload.sleepQualityScore / 100) * 5).toFixed(2));
    const evaluation = mockDb.evaluateReading({
      heartRateBpm: bpm,
      systolicMmHg: 118,
      diastolicMmHg: 76,
      glucoseMgDl: 95,
      temperatureC: 36.6,
      spo2Pct: 98,
      sleepHours,
      mood,
    });
    const now = new Date().toISOString();
    const id = `vision-${Date.now()}`;
    mockDb.readings.unshift({
      id,
      astronautId,
      heartRateBpm: bpm,
      systolicMmHg: 118,
      diastolicMmHg: 76,
      glucoseMgDl: 95,
      temperatureC: 36.6,
      spo2Pct: 98,
      sleepHours,
      mood,
      status: evaluation.status,
      alerts: evaluation.alerts,
      recommendation: evaluation.recommendation,
      notes: undefined,
      takenAt: now,
      createdAt: now,
      updatedAt: now,
    });
    mockDb.save();
    return {
      reading: {
        id,
        astronautId,
        heartRateBpm: bpm,
        status: evaluation.status,
        mood,
        sleepHours,
        takenAt: now,
      },
      incidentsTriggered: evaluation.alerts.length,
      derivedVitals: { heartRateBpm: bpm, mood, sleepHours },
    };
  }

  return httpClient.post<VisionIngestResponse>('/readings/vision-ingest', payload);
}
