/**
 * Client adapter for the Python/FastAPI Computer Vision telemetry service (`ENV.VISION_URL`)
 * and backend `/readings/vision-ingest` persistence endpoint.
 * Provides HTTP simulator ticks, webcam frame analysis, WebSocket URL resolution,
 * health checks, and 30s biometric-to-clinical reading ingestion with mock-DB fallback.
 *
 * @module features/vision/services/visionService
 */

import { ENV, isReachableServiceUrl } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';
import type {
  AstronautTelemetryFrame,
  CameraMode,
  MonitoringContext,
  SimState,
  VisionHealthResponse,
  VisionIngestResponse,
} from '../domain/types';

/** Returns the normalized Vision API base URL if reachable from the current origin, else `null`. */
export function getVisionBaseUrl(): string | null {
  if (!isReachableServiceUrl(ENV.VISION_URL)) return null;
  return ENV.VISION_URL.replace(/\/+$/, '');
}

/** Advances the Vision AI synthetic biometric simulator by one frame over HTTP (WebSocket fallback). */
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

/** Submits a captured JPEG webcam frame to `/api/analyze/frame` when WebSockets are unavailable. */
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

/** Resets Vision AI temporal rPPG and blink-rate ring buffers on the service. */
export async function resetVisionHttp(): Promise<void> {
  const base = getVisionBaseUrl();
  if (!base) return;
  await fetch(`${base}/api/reset`, { method: 'POST' }).catch(() => undefined);
}

/** Resolves the `ws://` or `wss://` telemetry stream endpoint if `ENV.VISION_URL` is reachable. */
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

/** Polls `/api/health` on the Vision microservice to inspect loaded ONNX/MediaPipe models. */
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

/**
 * Persists a Vision telemetry snapshot as a clinical health reading for `astronautId`.
 * Maps continuous valence (`[-1, 1]`) and sleep quality (`[0, 100]`) into clinical 1–5 mood
 * and 4–9h sleep scales in mock mode, or delegates to `/readings/vision-ingest` in API mode.
 */
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
