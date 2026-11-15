/**
 * In-browser mock transport for the `ai/vision` service when `NEXT_PUBLIC_USE_MOCKS=true`
 * or when the native Python Vision server (`:8000`) is unreachable.
 *
 * Synthesizes realistic `AstronautTelemetryFrame` payloads directly in the browser,
 * mirroring the Python pipeline thresholds:
 *  - `mood_engine`: operational affect labels and stress/alertness 0–100 scores
 *  - `sleep_engine`: PERCLOS, drowsiness states, and sleep stages
 *  - `rppg_engine`: ~10 s rolling calibration buffer, BVP waveform, and Welch spectrum
 *  - `pipeline._evaluate_mission_health`: clinical alerts and global health index
 *
 * Visual rendering of the subject is handled separately by `SyntheticHead3D`.
 */
import type {
  AstronautTelemetryFrame,
  CameraMode,
  MonitoringContext,
  SimState,
} from '../domain/types';

export interface MockTickParams {
  camera_mode: CameraMode;
  context: MonitoringContext;
  sim_bpm: number;
  sim_state: SimState;
}

interface StateProfile {
  bpmOffset: number;
  stress: number;
  valence: number;
  perclos: number;
  browFurrow: number;
  smile: number;
  earMean: number;
  movement: number;
  emotions: Record<string, number>;
}

const PROFILES: Record<SimState, StateProfile> = {
  nominal: {
    bpmOffset: 0,
    stress: 22,
    valence: 0.25,
    perclos: 6,
    browFurrow: 0.12,
    smile: 0.3,
    earMean: 0.29,
    movement: 8,
    emotions: { neutral: 0.62, happiness: 0.22, surprise: 0.05, sadness: 0.05, anger: 0.03, disgust: 0.03 },
  },
  stressed: {
    bpmOffset: 26,
    stress: 71,
    valence: -0.45,
    perclos: 9,
    browFurrow: 0.68,
    smile: 0.05,
    earMean: 0.31,
    movement: 22,
    emotions: { neutral: 0.2, happiness: 0.02, surprise: 0.08, sadness: 0.1, anger: 0.42, disgust: 0.18 },
  },
  drowsy: {
    bpmOffset: -9,
    stress: 30,
    valence: -0.15,
    perclos: 42,
    browFurrow: 0.1,
    smile: 0.04,
    earMean: 0.18,
    movement: 6,
    emotions: { neutral: 0.55, happiness: 0.03, surprise: 0.02, sadness: 0.32, anger: 0.04, disgust: 0.04 },
  },
  sleeping_deep: {
    bpmOffset: -18,
    stress: 8,
    valence: 0.05,
    perclos: 96,
    browFurrow: 0.02,
    smile: 0.02,
    earMean: 0.08,
    movement: 4,
    emotions: { neutral: 0.88, happiness: 0.02, surprise: 0.01, sadness: 0.06, anger: 0.01, disgust: 0.02 },
  },
};

const BUFFER_SECONDS = 10;
const WAVE_SAMPLES = 120; // 4 s at 30 Hz, matching rppg_engine buffer length
const SPECTRUM_BINS = 64;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 1) => Number(v.toFixed(d));
/** Approximate zero-mean Gaussian noise via Box-Muller transform. */
function gauss(sigma = 1): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}
/** Exponential smoothing step toward target value. */
const ease = (current: number, target: number, k: number) => current + (target - current) * k;

export class MockVisionSimulator {
  private startedAt = 0;
  private lastTs = 0;
  private frameIndex = 0;
  private bpm = 72;
  private stress = 20;
  private valence = 0.2;
  private perclos = 5;
  private movement = 8;
  private yawnCount = 0;
  private restlessEvents = 0;
  private blinkPhase = 0;

  reset(): void {
    this.startedAt = 0;
    this.frameIndex = 0;
    this.yawnCount = 0;
    this.restlessEvents = 0;
  }

  next(params: MockTickParams): AstronautTelemetryFrame {
    const now = Date.now() / 1000;
    if (!this.startedAt) this.startedAt = now;
    const dt = this.lastTs ? Math.min(1, now - this.lastTs) : 0.1;
    this.lastTs = now;
    this.frameIndex += 1;

    const profile = PROFILES[params.sim_state] ?? PROFILES.nominal;
    const k = clamp(dt * 1.2, 0.02, 0.5);

    const targetBpm = clamp(params.sim_bpm + profile.bpmOffset, 40, 160);
    this.bpm = ease(this.bpm, targetBpm + gauss(0.8), k);
    this.stress = ease(this.stress, profile.stress + gauss(2.5), k);
    this.valence = ease(this.valence, profile.valence + gauss(0.04), k);
    this.perclos = ease(this.perclos, profile.perclos + gauss(1.5), k);
    this.movement = ease(this.movement, profile.movement + Math.abs(gauss(3)), k);

    const elapsed = now - this.startedAt;
    const fill = clamp((elapsed / BUFFER_SECONDS) * 100, 0, 100);
    const calibrated = fill >= 100;
    const bpm = calibrated ? this.bpm : 0;

    // --- Eyes / Blinking / Yawns (sleep_engine) ---
    this.blinkPhase += dt;
    const blinking = params.sim_state !== 'sleeping_deep' && this.blinkPhase % 3.2 < 0.15;
    const earMean = clamp(profile.earMean + gauss(0.01) - (blinking ? 0.12 : 0), 0.04, 0.4);
    const earLeft = clamp(earMean + gauss(0.008), 0.03, 0.4);
    const earRight = clamp(earMean + gauss(0.008), 0.03, 0.4);
    const yawning = params.sim_state === 'drowsy' && Math.random() < 0.004;
    if (yawning) this.yawnCount += 1;
    if (this.movement >= 30 && Math.random() < 0.02) this.restlessEvents += 1;
    const microsleep =
      params.sim_state === 'drowsy' && params.context === 'cabin_active' && this.perclos >= 40 && Math.random() < 0.03;
    const headPitch = params.sim_state === 'drowsy' ? 14 + gauss(4) : gauss(3);
    const headNodding = Math.abs(headPitch) >= 18;
    const perclos = clamp(this.perclos, 0, 100);

    let sleepStage = 'Awake';
    let fatigueLevel = 'Nominal';
    let sleepQuality: number;
    if (params.context === 'sleep_pod') {
      if (perclos < 40) {
        fatigueLevel = 'Awake in Sleep Pod';
      } else if (this.movement <= 12) {
        sleepStage = 'Deep Rest';
        fatigueLevel = 'Sleeping (Restorative)';
      } else {
        sleepStage = 'Light/Restless Sleep';
        fatigueLevel = 'Sleeping (Restless)';
      }
      const continuity = Math.min(100, perclos * 1.15);
      const calmness = Math.max(0, 100 - this.movement * 1.8);
      const hrBonus = bpm === 0 || (bpm >= 45 && bpm <= 72) ? 100 : Math.max(40, 100 - (bpm - 72) * 1.5);
      sleepQuality = clamp(0.45 * continuity + 0.4 * calmness + 0.15 * hrBonus, 0, 100);
    } else {
      const penalty =
        perclos * 1.25 + Math.min(25, this.yawnCount * 8) + (microsleep ? 25 : 0) + (headNodding ? 15 : 0);
      sleepQuality = clamp(100 - penalty, 0, 100);
      if (microsleep) fatigueLevel = 'Microsleep Alert';
      else if (perclos >= 35 || (perclos >= 20 && headNodding)) fatigueLevel = 'High Drowsiness';
      else if (perclos >= 16 || this.yawnCount >= 1 || headNodding) fatigueLevel = 'Mild Fatigue';
    }

    // --- Mood & Affect (mood_engine) ---
    const emotions: Record<string, number> = {};
    let total = 0;
    for (const [label, p] of Object.entries(profile.emotions)) {
      const val = Math.max(0.001, p + gauss(0.02));
      emotions[label] = val;
      total += val;
    }
    let rawEmotion = 'neutral';
    let best = -1;
    for (const label of Object.keys(emotions)) {
      emotions[label] = round(emotions[label] / total, 3);
      if (emotions[label] > best) {
        best = emotions[label];
        rawEmotion = label;
      }
    }
    const stressIndex = clamp(this.stress, 5, 100);
    const earFactor = clamp((earMean - 0.15) / 0.16, 0, 1);
    const alertness = clamp(earFactor * 75 + (100 - perclos) * 0.25, 0, 100);
    let dominantMood = 'Calm / Focused';
    if (perclos >= 35 || earMean < 0.19) dominantMood = 'Fatigued / Drowsy';
    else if (stressIndex >= 58 || profile.browFurrow >= 0.55) dominantMood = 'Stressed / High Tension';
    else if ((emotions.happiness ?? 0) >= 0.34 || profile.smile >= 0.48) dominantMood = 'Positive / Engaged';
    else if ((emotions.sadness ?? 0) >= 0.35) dominantMood = 'Low Morale / Sad';

    // --- rPPG (rppg_engine) ---
    const sqiBase = params.camera_mode === 'nir_ir' ? 68 : params.camera_mode === 'rgb_chrom' ? 78 : 82;
    const signalQuality = calibrated ? clamp(sqiBase - this.movement * 0.6 + gauss(3), 5, 99) : fill * 0.3;
    const hrvRmssd = clamp(62 - (stressIndex - 20) * 0.55 + (params.context === 'sleep_pod' ? 14 : 0) + gauss(2), 12, 110);
    const respiration = clamp((params.sim_state === 'sleeping_deep' ? 12 : params.sim_state === 'stressed' ? 20 : 15) + gauss(0.6), 8, 30);

    const effectiveBpm = this.bpm;
    const hz = effectiveBpm / 60;
    const bvp: number[] = [];
    for (let i = 0; i < WAVE_SAMPLES; i += 1) {
      const t = now - (WAVE_SAMPLES - i) / 30;
      const phase = 2 * Math.PI * hz * t;
      const resp = 0.25 * Math.sin((2 * Math.PI * respiration * t) / 60);
      const v = Math.sin(phase) + 0.35 * Math.sin(2 * phase + 0.8) + resp + gauss((100 - signalQuality) / 120);
      bvp.push(round(clamp(v * 1.2, -3.5, 3.5), 3));
    }
    const spectrumFreqs: number[] = [];
    const spectrumPower: number[] = [];
    for (let i = 0; i < SPECTRUM_BINS; i += 1) {
      const f = 42 + (i * (180 - 42)) / (SPECTRUM_BINS - 1);
      const peak = Math.exp(-((f - effectiveBpm) ** 2) / (2 * 4 ** 2));
      const harmonic = 0.25 * Math.exp(-((f - effectiveBpm * 2) ** 2) / (2 * 6 ** 2));
      spectrumFreqs.push(round(f, 1));
      spectrumPower.push(round(clamp(peak + harmonic + Math.abs(gauss(0.05)), 0, 1), 3));
    }

    const hrStatus = !calibrated ? 'calibrating' : signalQuality >= 30 ? 'locked' : 'low_signal';

    // --- Global Health Index & Alerts (pipeline) ---
    const alerts: string[] = [];
    if (microsleep) alerts.push('CRITICAL: MICROSLEEP DETECTED ON DUTY');
    else if (perclos >= 35 && params.context === 'cabin_active')
      alerts.push(`HIGH DROWSINESS WARNING (PERCLOS ${perclos.toFixed(0)}%)`);
    if (stressIndex >= 62) alerts.push(`ELEVATED PSYCHOLOGICAL STRESS (${stressIndex.toFixed(0)}%)`);
    if (bpm > 0) {
      if (bpm >= 115) alerts.push(`TACHYCARDIA ALERT (${bpm.toFixed(0)} BPM)`);
      else if (bpm <= 46) alerts.push(`BRADYCARDIA ALERT (${bpm.toFixed(0)} BPM)`);
    }
    if (params.context === 'sleep_pod' && this.movement >= 30) alerts.push('FRAGMENTED / RESTLESS SLEEP DETECTED');

    const calmScore = 100 - stressIndex * 0.75;
    const hrScore = bpm > 0 ? clamp(100 - Math.max(0, Math.abs(bpm - 70) - 12) * 1.4, 30, 100) : 95;
    const health = clamp(0.4 * sleepQuality + 0.35 * calmScore + 0.25 * hrScore, 0, 100);

    const fps = clamp(1 / Math.max(dt, 0.001), 1, 30);

    const frame: AstronautTelemetryFrame = {
      timestamp: now,
      frame_index: this.frameIndex,
      face_detected: true,
      fps: round(fps, 1),
      camera_mode: params.camera_mode,
      context: params.context,
      overall_health_index: round(health),
      alerts,
      mood: {
        dominant_mood: dominantMood,
        raw_emotion: rawEmotion,
        emotion_probabilities: emotions,
        mood_valence: round(clamp(this.valence, -1, 1), 3),
        stress_index: round(stressIndex),
        alertness_score: round(alertness),
        brow_furrow_score: round(clamp(profile.browFurrow + gauss(0.03), 0, 1), 3),
        smile_score: round(clamp(profile.smile + gauss(0.03), 0, 1), 3),
        model_backend: 'mock-simulator',
      },
      sleep: {
        sleep_quality_score: round(sleepQuality),
        fatigue_level: fatigueLevel,
        sleep_stage_estimate: sleepStage,
        ear_left: round(earLeft, 3),
        ear_right: round(earRight, 3),
        ear_mean: round(earMean, 3),
        mar: round(yawning ? 0.75 : clamp(0.12 + gauss(0.02), 0, 1), 3),
        perclos: round(perclos),
        blink_rate_per_min: round(params.sim_state === 'sleeping_deep' ? 0 : params.sim_state === 'drowsy' ? 9 : 17),
        yawn_count: this.yawnCount,
        microsleep_detected: microsleep,
        head_pitch_deg: round(headPitch),
        head_yaw_deg: round(gauss(4)),
        head_roll_deg: round(gauss(2)),
        movement_index: round(this.movement),
        restlessness_events: this.restlessEvents,
      },
      heart_rate: {
        bpm: round(bpm),
        hrv_rmssd_ms: round(hrvRmssd),
        hrv_sdnn_ms: round(hrvRmssd * 1.25),
        respiration_rpm: round(respiration),
        signal_quality: round(signalQuality),
        camera_mode: params.camera_mode,
        buffer_fill_pct: round(fill),
        bvp_waveform: bvp,
        spectrum_freqs_bpm: spectrumFreqs,
        spectrum_power: spectrumPower,
        status: hrStatus,
      },
      annotated_frame_jpeg_b64: null,
    };

    return frame;
  }
}
