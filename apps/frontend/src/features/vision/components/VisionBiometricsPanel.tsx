'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Camera,
  CheckCircle2,
  Database,
  Eye,
  HeartPulse,
  Moon,
  RefreshCw,
  RotateCcw,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useActiveAstronaut } from '@/features/health/hooks/useActiveAstronaut';
import { StatusBadge } from '@/features/health/components/StatusBadge';
import { API_STATUS } from '@/features/health/domain/api-adapter';
import type {
  AstronautTelemetryFrame,
  CameraMode,
  MonitoringContext,
  SimState,
  VisionIngestResponse,
  VisionSource,
} from '../domain/types';
import { getVisionWsUrl, ingestVisionTelemetry } from '../services/visionService';

const SYNC_INTERVAL_SEC = 30;

const SIM_PRESETS: { value: SimState; label: string; context: MonitoringContext }[] = [
  { value: 'nominal', label: 'Nominal Cabin', context: 'cabin_active' },
  { value: 'stressed', label: 'High Stress', context: 'cabin_active' },
  { value: 'drowsy', label: 'Drowsy / PERCLOS', context: 'cabin_active' },
  { value: 'sleeping_deep', label: 'Deep Sleep Pod', context: 'sleep_pod' },
];

export function VisionBiometricsPanel() {
  const { astronautId, setAstronautId, crew } = useActiveAstronaut();

  const [source, setSource] = useState<VisionSource>('simulator');
  const [cameraMode, setCameraMode] = useState<CameraMode>('rgb_pos');
  const [context, setContext] = useState<MonitoringContext>('cabin_active');
  const [simState, setSimState] = useState<SimState>('nominal');
  const [simBpm, setSimBpm] = useState<number>(72);
  const [streaming, setStreaming] = useState<boolean>(true);

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [telemetry, setTelemetry] = useState<AstronautTelemetryFrame | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // 30s DB transaction auto-sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [countdownSec, setCountdownSec] = useState<number>(SYNC_INTERVAL_SEC);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<{
    at: string;
    result: VisionIngestResponse;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const awaitingRef = useRef<boolean>(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const bvpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const psdCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Latest refs for intervals so timers don't reset on every frame
  const latestTelemetryRef = useRef<AstronautTelemetryFrame | null>(null);
  const astronautIdRef = useRef<string | undefined>(astronautId);
  const sourceRef = useRef<VisionSource>(source);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const contextRef = useRef<MonitoringContext>(context);
  const simStateRef = useRef<SimState>(simState);
  const simBpmRef = useRef<number>(simBpm);
  const streamingRef = useRef<boolean>(streaming);

  useEffect(() => {
    astronautIdRef.current = astronautId;
  }, [astronautId]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);
  useEffect(() => {
    simStateRef.current = simState;
  }, [simState]);
  useEffect(() => {
    simBpmRef.current = simBpm;
  }, [simBpm]);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Draw BVP waveform and Power Spectrum whenever telemetry updates
  useEffect(() => {
    if (!telemetry) return;

    const bvpCanvas = bvpCanvasRef.current;
    if (bvpCanvas) {
      const ctx = bvpCanvas.getContext('2d');
      if (ctx) {
        const w = bvpCanvas.width;
        const h = bvpCanvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        const samples = telemetry.heart_rate.bvp_waveform;
        if (samples && samples.length >= 2) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const step = w / (samples.length - 1);
          for (let i = 0; i < samples.length; i++) {
            const x = i * step;
            const y = h / 2 - (samples[i] / 3.2) * (h * 0.42);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }

    const psdCanvas = psdCanvasRef.current;
    if (psdCanvas) {
      const ctx = psdCanvas.getContext('2d');
      if (ctx) {
        const w = psdCanvas.width;
        const h = psdCanvas.height;
        ctx.clearRect(0, 0, w, h);
        const freqs = telemetry.heart_rate.spectrum_freqs_bpm;
        const power = telemetry.heart_rate.spectrum_power;
        const peakBpm = telemetry.heart_rate.bpm;
        if (freqs && freqs.length >= 2 && power && power.length === freqs.length) {
          const barW = Math.max(2, w / freqs.length - 1);
          for (let i = 0; i < freqs.length; i++) {
            const x = (i / freqs.length) * w;
            const barH = power[i] * (h - 14);
            const isPeak = Math.abs(freqs[i] - peakBpm) < 5.0;
            ctx.fillStyle = isPeak ? '#f43f5e' : 'rgba(56, 189, 248, 0.5)';
            ctx.fillRect(x, h - barH, barW, barH);
          }
        }
      }
    }
  }, [telemetry]);

  // Manage local webcam stream when source === 'webcam'
  useEffect(() => {
    let cancelled = false;

    async function enableWebcam() {
      setWebcamError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: { ideal: 30 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setWebcamError('Could not access local webcam. Switched back to Simulator.');
          setSource('simulator');
        }
      }
    }

    function stopWebcam() {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
        webcamStreamRef.current = null;
      }
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = null;
      }
    }

    if (source === 'webcam') {
      void enableWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      cancelled = true;
      stopWebcam();
    };
  }, [source]);

  // WebSocket connection to ai/vision
  useEffect(() => {
    const wsUrl = getVisionWsUrl();
    if (!wsUrl) {
      setWsStatus('offline');
      return;
    }

    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (unmounted) return;
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl!);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsStatus('connected');
        awaitingRef.current = false;
      };

      ws.onmessage = (event) => {
        awaitingRef.current = false;
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'ack' || data?.type === 'error') return;
          const frame = data as AstronautTelemetryFrame;
          latestTelemetryRef.current = frame;
          setTelemetry(frame);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        if (!unmounted) setWsStatus('offline');
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsStatus('offline');
        reconnectTimer = setTimeout(connect, 2500);
      };
    }

    connect();

    const frameLoop = setInterval(() => {
      const ws = wsRef.current;
      if (!streamingRef.current || !ws || ws.readyState !== WebSocket.OPEN || awaitingRef.current) {
        return;
      }

      if (sourceRef.current === 'simulator') {
        awaitingRef.current = true;
        ws.send(
          JSON.stringify({
            type: 'tick',
            camera_mode: cameraModeRef.current,
            context: contextRef.current,
            sim_bpm: simBpmRef.current,
            sim_state: simStateRef.current,
          })
        );
      } else if (sourceRef.current === 'webcam') {
        const video = webcamVideoRef.current;
        const canvas = captureCanvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
            awaitingRef.current = true;
            ws.send(
              JSON.stringify({
                type: 'frame',
                image_b64: dataUrl,
                timestamp: performance.now() / 1000.0,
                camera_mode: cameraModeRef.current,
                context: contextRef.current,
                include_hud: true,
              })
            );
          }
        }
      }
    }, 65);

    return () => {
      unmounted = true;
      clearInterval(frameLoop);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const syncToDbNow = useCallback(async () => {
    const targetAstro = astronautIdRef.current;
    const frame = latestTelemetryRef.current;
    if (!targetAstro || !frame || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await ingestVisionTelemetry(targetAstro, frame);
      setLastSync({
        at: new Date().toLocaleTimeString(),
        result,
      });
      setSyncCount((c) => c + 1);
      setCountdownSec(SYNC_INTERVAL_SEC);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync vision reading to DB');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // 30-second automatic DB transaction timer
  useEffect(() => {
    if (!autoSyncEnabled || !streaming) return;

    const timer = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          void syncToDbNow();
          return SYNC_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, streaming, syncToDbNow]);

  const handleResetPipeline = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  };

  const handlePresetChange = (preset: SimState) => {
    setSimState(preset);
    const match = SIM_PRESETS.find((p) => p.value === preset);
    if (match) setContext(match.context);
  };

  const hr = telemetry?.heart_rate;
  const mood = telemetry?.mood;
  const sleep = telemetry?.sleep;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-berry">
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Contactless Computer Vision Biometrics (ai/vision)</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            Vision AI &amp; rPPG Monitor
          </h1>
          <p className="mt-1 text-xs text-stem">
            Real-time facial landmarks, emotion ONNX, PERCLOS fatigue, and rPPG heart rate — auto-committed to PostgreSQL every 30s.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {crew.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-medium text-stem">
              <span>Crew</span>
              <select
                value={astronautId ?? ''}
                onChange={(e) => setAstronautId(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-blueberry"
              >
                {crew.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <span
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold ${
              wsStatus === 'connected'
                ? 'border-status-nominal/40 bg-status-nominal/10 text-status-nominal'
                : wsStatus === 'connecting'
                ? 'border-status-caution/40 bg-status-caution/10 text-status-caution'
                : 'border-status-critical/40 bg-status-critical/10 text-status-critical'
            }`}
          >
            {wsStatus === 'connected' ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {wsStatus === 'connected'
                ? `Vision WS Live${telemetry ? ` · ${telemetry.fps.toFixed(0)} FPS` : ''}`
                : wsStatus === 'connecting'
                ? 'Connecting to Vision...'
                : 'Vision Service Offline'}
            </span>
          </span>
        </div>
      </header>

      {/* 30s Auto-Sync DB Transaction Bar */}
      <section
        aria-label="Database Auto-Sync Transaction Status"
        className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-berry/10 text-berry">
            <Database className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-blueberry">
                30s DB Transaction Pipeline
              </span>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[11px] text-stem">
                {autoSyncEnabled ? `Next commit in ${countdownSec}s` : 'Auto-sync paused'}
              </span>
              {syncCount > 0 && (
                <span className="rounded-pill bg-status-nominal/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-status-nominal">
                  {syncCount} tx committed
                </span>
              )}
            </div>
            {lastSync ? (
              <p className="text-[11px] text-stem">
                <CheckCircle2 className="mr-1 inline h-3 w-3 text-status-nominal" aria-hidden="true" />
                Last DB commit at <strong className="text-blueberry">{lastSync.at}</strong> · HR{' '}
                {lastSync.result.derivedVitals.heartRateBpm} bpm · Mood {lastSync.result.derivedVitals.mood}/5 · Sleep{' '}
                {lastSync.result.derivedVitals.sleepHours}h · Status{' '}
                <StatusBadge status={API_STATUS[lastSync.result.reading.status] ?? 'unknown'} compact />
                {lastSync.result.incidentsTriggered > 0 && (
                  <span className="ml-2 font-semibold text-status-critical">
                    ({lastSync.result.incidentsTriggered} incident triggered)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[11px] text-stem">
                Feeds Digital Twin, Signal vs. Noise Biodosimetry, and Medical Incident triggers automatically.
              </p>
            )}
            {syncError && (
              <p className="text-[11px] font-medium text-status-critical">{syncError}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSyncEnabled((v) => !v)}
            className="tactile-press rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
          >
            {autoSyncEnabled ? 'Pause Auto-Sync' : 'Resume Auto-Sync'}
          </button>
          <button
            type="button"
            disabled={!telemetry || !astronautId || isSyncing}
            onClick={() => void syncToDbNow()}
            className="tactile-press inline-flex items-center gap-1.5 rounded-lg bg-blueberry px-3 py-1.5 text-xs font-semibold text-plate disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isSyncing ? 'Committing...' : 'Commit Now'}</span>
          </button>
        </div>
      </section>

      {wsStatus === 'offline' && (
        <div className="rounded-lg border border-status-caution/40 bg-status-caution/10 p-4 text-xs text-blueberry">
          <p className="font-semibold">Vision AI service is not reachable at localhost:8000</p>
          <p className="mt-1 text-stem">
            Start it with:{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px]">
              cd ai/vision &amp;&amp; .venv/bin/python run.py --port 8000
            </code>
          </p>
        </div>
      )}

      {webcamError && (
        <div className="rounded-lg border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
          {webcamError}
        </div>
      )}

      {telemetry && telemetry.alerts.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-status-critical/50 bg-status-critical/10 px-4 py-3 text-xs font-semibold text-status-critical"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Active Vision Alerts: {telemetry.alerts.join(' · ')}</span>
        </div>
      )}

      {/* Main Split: Video HUD + Controls | Biometric Cards */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: Camera HUD + Stream Controls */}
        <div className="surface-card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-berry" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-blueberry">Optical Biometric HUD</h2>
            </div>
            <div className="flex items-center gap-2">
              {telemetry && (
                <span className="rounded-pill bg-surface-tinted px-2.5 py-0.5 font-mono text-[11px] font-semibold text-blueberry">
                  Health Index: {telemetry.overall_health_index.toFixed(0)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => setStreaming((s) => !s)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-blueberry hover:bg-surface-tinted"
              >
                {streaming ? 'Pause Stream' : 'Resume Stream'}
              </button>
              <button
                type="button"
                onClick={handleResetPipeline}
                title="Reset rPPG & Blink Buffers"
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-stem hover:text-blueberry"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* HUD Frame */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-slate-950">
            {telemetry?.annotated_frame_jpeg_b64 ? (
              <img
                src={`data:image/jpeg;base64,${telemetry.annotated_frame_jpeg_b64}`}
                alt="Vision AI Biometric HUD"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-slate-400">
                <Activity className="h-6 w-6 animate-pulse text-sky-400" aria-hidden="true" />
                <span>Waiting for Vision AI telemetry stream...</span>
              </div>
            )}
            <video ref={webcamVideoRef} autoPlay playsInline muted className="hidden" />
            <canvas ref={captureCanvasRef} width={480} height={360} className="hidden" />
          </div>

          {/* Source & Mode Controls */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>Input Source</span>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as VisionSource);
                  handleResetPipeline();
                }}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-blueberry"
              >
                <option value="simulator">Synthetic Astronaut</option>
                <option value="webcam">Local Webcam</option>
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>rPPG Algorithm</span>
              <select
                value={cameraMode}
                onChange={(e) => setCameraMode(e.target.value as CameraMode)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-blueberry"
              >
                <option value="rgb_pos">RGB (POS)</option>
                <option value="rgb_chrom">RGB (CHROM)</option>
                <option value="nir_ir">NIR / Night Vision</option>
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>Mission Context</span>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as MonitoringContext)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-blueberry"
              >
                <option value="cabin_active">Cabin Active</option>
                <option value="sleep_pod">Sleep Pod</option>
              </select>
            </label>
          </div>

          {source === 'simulator' && (
            <div className="space-y-2 rounded-lg border border-line bg-surface-tinted/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stem">
                  Simulator Presets
                </span>
                <span className="font-mono text-xs font-semibold text-blueberry">
                  Target: {simBpm} BPM
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SIM_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePresetChange(p.value)}
                    className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      simState === p.value
                        ? 'bg-blueberry text-plate'
                        : 'border border-line bg-surface text-stem hover:text-blueberry'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={48}
                max={150}
                value={simBpm}
                onChange={(e) => setSimBpm(Number(e.target.value))}
                className="w-full accent-berry"
                aria-label="Simulated Heart Rate BPM"
              />
            </div>
          )}
        </div>

        {/* Right: 3 Biometric Engine Cards */}
        <div className="space-y-4">
          {/* 1. Cardiovascular rPPG */}
          <section className="surface-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-status-critical" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-blueberry">Cardiovascular (rPPG)</h2>
              </div>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-stem">
                {hr ? hr.status : 'idle'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-stem">Heart Rate</p>
                <p className="font-mono text-xl font-bold text-blueberry">
                  {hr && hr.bpm > 0 ? hr.bpm.toFixed(1) : '--'}
                  <span className="ml-1 text-[11px] font-normal text-stem">BPM</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">HRV (RMSSD)</p>
                <p className="font-mono text-base font-semibold text-blueberry">
                  {hr ? `${hr.hrv_rmssd_ms.toFixed(1)} ms` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Respiration</p>
                <p className="font-mono text-base font-semibold text-blueberry">
                  {hr ? `${hr.respiration_rpm.toFixed(1)} rpm` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Signal SQI</p>
                <p className="font-mono text-base font-semibold text-blueberry">
                  {hr ? `${hr.signal_quality.toFixed(0)}%` : '--'}
                </p>
              </div>
            </div>

            {/* Buffer Fill */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-stem">
                <span>Temporal Window Buffer</span>
                <span className="font-mono">{hr ? `${hr.buffer_fill_pct.toFixed(0)}%` : '0%'}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tinted">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${hr?.buffer_fill_pct ?? 0}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-slate-950/90 p-2">
                <p className="mb-1 font-mono text-[10px] text-slate-400">BVP Waveform</p>
                <canvas ref={bvpCanvasRef} width={260} height={64} className="h-16 w-full" />
              </div>
              <div className="rounded-lg border border-line bg-slate-950/90 p-2">
                <p className="mb-1 font-mono text-[10px] text-slate-400">Power Spectrum (PSD)</p>
                <canvas ref={psdCanvasRef} width={260} height={64} className="h-16 w-full" />
              </div>
            </div>
          </section>

          {/* 2. Mood & Psychological Stress */}
          <section className="surface-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-berry" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-blueberry">Mood &amp; Cognitive Stress</h2>
              </div>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] text-stem">
                {mood?.model_backend ?? 'onnx+au'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-stem">Dominant State</p>
                <p className="text-xs font-bold text-blueberry">{mood?.dominant_mood ?? '--'}</p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Raw Emotion</p>
                <p className="text-xs font-semibold text-blueberry">{mood?.raw_emotion ?? '--'}</p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Valence</p>
                <p className="font-mono text-xs font-semibold text-blueberry">
                  {mood ? mood.mood_valence.toFixed(2) : '--'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stem">Stress Index</span>
                  <span className="font-mono font-semibold text-blueberry">
                    {mood ? `${mood.stress_index.toFixed(0)}%` : '--'}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tinted">
                  <div
                    className="h-full bg-status-critical transition-all"
                    style={{ width: `${mood?.stress_index ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stem">Cognitive Alertness</span>
                  <span className="font-mono font-semibold text-blueberry">
                    {mood ? `${mood.alertness_score.toFixed(0)}%` : '--'}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tinted">
                  <div
                    className="h-full bg-status-nominal transition-all"
                    style={{ width: `${mood?.alertness_score ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Sleep & Fatigue */}
          <section className="surface-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-blueberry">Sleep, PERCLOS &amp; Fatigue</h2>
              </div>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-stem">
                {sleep?.fatigue_level ?? 'Nominal'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <div>
                <p className="text-[11px] text-stem">Sleep Score</p>
                <p className="font-mono text-base font-bold text-blueberry">
                  {sleep ? `${sleep.sleep_quality_score.toFixed(0)}%` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">PERCLOS</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? `${sleep.perclos.toFixed(1)}%` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">EAR Mean</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? sleep.ear_mean.toFixed(3) : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Blinks/min</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? sleep.blink_rate_per_min.toFixed(1) : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Yawns</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? sleep.yawn_count : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Stage</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-blueberry">
                  <Eye className="h-3 w-3 text-berry" aria-hidden="true" />
                  <span>{sleep?.sleep_stage_estimate ?? '--'}</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
