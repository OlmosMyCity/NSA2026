'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Camera,
  Eye,
  HeartPulse,
  Moon,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useActiveAstronaut } from '@/features/health/hooks/useActiveAstronaut';
import type {
  AstronautTelemetryFrame,
  CameraMode,
  MonitoringContext,
  VisionSource,
} from '../domain/types';
import {
  analyzeWebcamFrameHttp,
  checkVisionHealth,
  getVisionWsUrl,
  ingestVisionTelemetry,
  resetVisionHttp,
  tickSimulatorHttp,
} from '../services/visionService';
import { MockVisionSimulator } from '../services/visionMock';
import dynamic from 'next/dynamic';

const SyntheticHead3D = dynamic(() => import('./SyntheticHead3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[11px] text-slate-400">
      Loading synthetic subject…
    </div>
  ),
});
import { ENV } from '@/features/common/config/env';

const SYNC_INTERVAL_MS = 30_000;
const DEFAULT_CAMERA_MODE: CameraMode = 'rgb_pos';
const DEFAULT_SIM_BPM = 72;
const DEFAULT_SIM_STATE = 'nominal' as const;

export function VisionBiometricsPanel() {
  const { astronautId, setAstronautId, crew } = useActiveAstronaut();

  const [source, setSource] = useState<VisionSource>('simulator');
  const [context, setContext] = useState<MonitoringContext>('cabin_active');
  const [streaming, setStreaming] = useState<boolean>(true);

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'http-live' | 'mock-live' | 'offline'>('connecting');
  const [telemetry, setTelemetry] = useState<AstronautTelemetryFrame | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mockSimRef = useRef<MockVisionSimulator | null>(null);
  const awaitingRef = useRef<boolean>(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Latest refs for intervals so timers don't reset on every frame
  const latestTelemetryRef = useRef<AstronautTelemetryFrame | null>(null);
  const astronautIdRef = useRef<string | undefined>(astronautId);
  const sourceRef = useRef<VisionSource>(source);
  const contextRef = useRef<MonitoringContext>(context);
  const streamingRef = useRef<boolean>(streaming);

  useEffect(() => {
    astronautIdRef.current = astronautId;
  }, [astronautId]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Manage local webcam stream when source === 'webcam'
  useEffect(() => {
    let cancelled = false;

    async function enableWebcam() {
      setWebcamError(null);
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setWebcamError(
          'Camera blocked: the browser only allows cameras on https:// or http://localhost. Switched back to cabin feed.'
        );
        setSource('simulator');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setWebcamError('This browser does not support camera capture. Switched back to cabin feed.');
        setSource('simulator');
        return;
      }
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
      } catch (err) {
        if (!cancelled) {
          const name = err instanceof DOMException ? err.name : '';
          const reason =
            name === 'NotAllowedError' || name === 'SecurityError'
              ? 'camera permission denied (check the lock icon in the address bar)'
              : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'no camera found on this device'
              : name === 'NotReadableError' || name === 'AbortError'
              ? 'camera is in use by another app (Zoom, Teams, OBS, Python service...)'
              : err instanceof Error
              ? err.message
              : 'unknown error';
          setWebcamError(`Could not access local camera: ${reason}. Switched back to cabin feed.`);
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

  // Optical telemetry connection with automatic HTTP fallback
  useEffect(() => {
    const wsUrl = getVisionWsUrl();

    let unmounted = false;
    let mode: 'ws' | 'http' | 'mock' = 'ws';
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let wsOpened = false;
    let lastMockAt = 0;

    // Fallback mock transport: when ai/vision (:8000) is unreachable, simulate
    // telemetry in-browser; seamlessly switch to live service (including webcam) when online.
    const MOCK_FRAME_MS = 100; // ~10 FPS
    const MOCK_PROBE_MS = 10_000;

    function startMock() {
      if (unmounted || mode === 'mock') return;
      mode = 'mock';
      if (!mockSimRef.current) mockSimRef.current = new MockVisionSimulator();
      awaitingRef.current = false;
      setWsStatus('mock-live');
      if (wsUrl) reconnectTimer = setTimeout(probeRealService, MOCK_PROBE_MS);
    }

    async function probeRealService() {
      if (unmounted || mode !== 'mock') return;
      const health = await checkVisionHealth();
      if (unmounted || mode !== 'mock') return;
      if (health?.status === 'ok') {
        mockSimRef.current = null;
        if (wsUrl!.includes('.vercel.app')) {
          mode = 'http';
          setWsStatus('http-live');
        } else {
          connectWs();
        }
      } else {
        reconnectTimer = setTimeout(probeRealService, MOCK_PROBE_MS);
      }
    }

    async function fallbackToHttpOrRetry() {
      if (unmounted) return;
      const health = await checkVisionHealth();
      if (unmounted) return;
      if (health?.status === 'ok') {
        mode = 'http';
        awaitingRef.current = false;
        setWsStatus('http-live');
      } else if (ENV.USE_MOCKS) {
        startMock();
      } else {
        setWsStatus('offline');
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    }

    function connectWs() {
      if (unmounted) return;
      mode = 'ws';
      wsOpened = false;
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl!);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        wsOpened = true;
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
        if (!unmounted && !wsOpened) {
          void fallbackToHttpOrRetry();
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        if (!wsOpened) {
          void fallbackToHttpOrRetry();
        } else {
          setWsStatus('offline');
          reconnectTimer = setTimeout(connectWs, 2500);
        }
      };
    }

    if (!wsUrl) {
      if (ENV.USE_MOCKS) {
        startMock();
      } else {
        setWsStatus('offline');
      }
    } else if (wsUrl.includes('.vercel.app')) {
      void fallbackToHttpOrRetry();
    } else {
      connectWs();
    }

    const frameLoop = setInterval(() => {
      if (!streamingRef.current || awaitingRef.current) return;

      if (mode === 'mock') {
        const sim = mockSimRef.current;
        const now = Date.now();
        if (!sim || now - lastMockAt < MOCK_FRAME_MS) return;
        lastMockAt = now;
        const frame = sim.next({
          camera_mode: DEFAULT_CAMERA_MODE,
          context: contextRef.current,
          sim_bpm: DEFAULT_SIM_BPM,
          sim_state: DEFAULT_SIM_STATE,
        });
        latestTelemetryRef.current = frame;
        setTelemetry(frame);
        return;
      }

      if (mode === 'ws') {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        if (sourceRef.current === 'simulator') {
          awaitingRef.current = true;
          ws.send(
            JSON.stringify({
              type: 'tick',
              camera_mode: DEFAULT_CAMERA_MODE,
              context: contextRef.current,
              sim_bpm: DEFAULT_SIM_BPM,
              sim_state: DEFAULT_SIM_STATE,
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
                  camera_mode: DEFAULT_CAMERA_MODE,
                  context: contextRef.current,
                  include_hud: false,
                })
              );
            }
          }
        }
        return;
      }

      if (sourceRef.current === 'simulator') {
        awaitingRef.current = true;
        void tickSimulatorHttp({
          camera_mode: DEFAULT_CAMERA_MODE,
          context: contextRef.current,
          sim_bpm: DEFAULT_SIM_BPM,
          sim_state: DEFAULT_SIM_STATE,
        })
          .then((frame) => {
            if (unmounted) return;
            latestTelemetryRef.current = frame;
            setTelemetry(frame);
            setWsStatus('http-live');
          })
          .catch(() => {
            if (!unmounted) setWsStatus('offline');
          })
          .finally(() => {
            awaitingRef.current = false;
          });
      } else if (sourceRef.current === 'webcam') {
        const video = webcamVideoRef.current;
        const canvas = captureCanvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            awaitingRef.current = true;
            canvas.toBlob(
              (blob) => {
                if (!blob || unmounted) {
                  awaitingRef.current = false;
                  return;
                }
                void analyzeWebcamFrameHttp({
                  blob,
                  camera_mode: DEFAULT_CAMERA_MODE,
                  context: contextRef.current,
                  include_hud: false,
                })
                  .then((frame) => {
                    if (unmounted) return;
                    latestTelemetryRef.current = frame;
                    setTelemetry(frame);
                    setWsStatus('http-live');
                  })
                  .catch(() => {
                    if (!unmounted) setWsStatus('offline');
                  })
                  .finally(() => {
                    awaitingRef.current = false;
                  });
              },
              'image/jpeg',
              0.65
            );
          }
        }
      }
    }, 50);

    return () => {
      unmounted = true;
      mockSimRef.current = null;
      clearInterval(frameLoop);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const syncTelemetry = useCallback(async () => {
    const targetAstro = astronautIdRef.current;
    const frame = latestTelemetryRef.current;
    if (!targetAstro || !frame || isSyncingRef.current) return;

    isSyncingRef.current = true;
    try {
      await ingestVisionTelemetry(targetAstro, frame);
    } catch {
      // Background telemetry persistence failure does not block live view
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Silent background persistence to crew health record every 30s
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      void syncTelemetry();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [streaming, syncTelemetry]);

  const handleResetPipeline = () => {
    if (mockSimRef.current) {
      mockSimRef.current.reset();
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    } else {
      void resetVisionHttp();
    }
  };

  const hr = telemetry?.heart_rate;
  const mood = telemetry?.mood;
  const sleep = telemetry?.sleep;
  const isLive = wsStatus === 'connected' || wsStatus === 'http-live' || wsStatus === 'mock-live';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-berry">
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Contactless Optical Biometrics</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            Crew Optical Biometrics &amp; Fatigue
          </h1>
          <p className="mt-1 text-xs text-stem">
            Contactless HR, HRV, stress, and ocular fatigue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {crew.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-medium text-stem">
              <span>Crew</span>
              <select
                value={astronautId ?? ''}
                onChange={(e) => setAstronautId(e.target.value)}
                className="twin-select w-auto min-w-[9rem] font-semibold"
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
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold backdrop-blur-md ${
              isLive
                ? 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] text-status-nominal'
                : wsStatus === 'connecting'
                  ? 'border-[var(--status-caution-border)] bg-[var(--status-caution-bg)] text-status-caution'
                  : 'border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-status-critical'
            }`}
          >
            {isLive ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {isLive
                ? 'Optical Telemetry Active'
                : wsStatus === 'connecting'
                  ? 'Connecting Sensor…'
                  : 'Sensor Standby'}
            </span>
          </span>
        </div>
      </header>

      {webcamError && (
        <div className="rounded-lg border border-[var(--status-critical-border)] bg-slate-950/90 p-3 text-xs font-medium text-status-critical backdrop-blur-md">
          {webcamError}
        </div>
      )}

      {telemetry && telemetry.alerts.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[var(--status-critical-border)] bg-slate-950/90 px-4 py-3 text-xs font-semibold text-status-critical backdrop-blur-md"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Active Biometric Alerts: {telemetry.alerts.join(' · ')}</span>
        </div>
      )}

      {/* Main Split: Optical Feed + Controls | Biometric Cards */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: Optical Sensor Feed & Stream Controls */}
        <div className="surface-card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-berry" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-blueberry">Optical Sensor Feed</h2>
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
            </div>
          </div>

          {/* Sensor Feed Viewport */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-slate-950">
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${source === 'webcam' ? 'block' : 'hidden'}`}
            />
            {source !== 'webcam' && (
              <div className="absolute inset-0">
                <SyntheticHead3D telemetry={telemetry} />
                <div className="hud-scanline pointer-events-none absolute inset-x-0 h-16" aria-hidden="true" />
              </div>
            )}
            {(source === 'webcam' || telemetry) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-pill border px-2.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md ${
                      telemetry?.face_detected
                        ? 'border-[var(--status-nominal-border)] bg-slate-950/75 text-status-nominal'
                        : 'border-[var(--status-caution-border)] bg-slate-950/75 text-status-caution'
                    }`}
                  >
                    {source !== 'webcam'
                      ? 'CABIN SUBJECT · 3D'
                      : telemetry?.face_detected
                      ? 'SUBJECT LOCKED'
                      : 'SCANNING SUBJECT...'}
                  </span>
                  {telemetry && (
                    <span className="rounded-pill border border-line bg-slate-950/75 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-blueberry backdrop-blur-md">
                      {telemetry.heart_rate.bpm > 0 ? `${telemetry.heart_rate.bpm.toFixed(0)} BPM` : 'CALIBRATING'} · {telemetry.mood.dominant_mood}
                    </span>
                  )}
                </div>
                {telemetry && (
                  <div className="flex items-center justify-start gap-2 font-mono text-[10px] text-blueberry">
                    <span className="rounded bg-slate-950/75 px-2 py-0.5 backdrop-blur-md">
                      STRESS {telemetry.mood.stress_index.toFixed(0)}% · PERCLOS {telemetry.sleep.perclos.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
            <canvas ref={captureCanvasRef} width={384} height={288} className="hidden" />
          </div>

          {/* Source & Context Controls */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>Sensor Source</span>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as VisionSource);
                  handleResetPipeline();
                }}
                className="twin-select font-semibold"
              >
                <option value="simulator">Cabin Optical Feed</option>
                <option value="webcam">Local Camera</option>
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>Mission Context</span>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as MonitoringContext)}
                className="twin-select font-semibold"
              >
                <option value="cabin_active">Cabin Active</option>
                <option value="sleep_pod">Sleep Pod</option>
              </select>
            </label>
          </div>
        </div>

        {/* Right: 3 Biometric Cards */}
        <div className="space-y-4">
          {/* 1. Cardiovascular */}
          <section className="surface-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-status-critical" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-blueberry">Cardiovascular</h2>
              </div>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-stem">
                {hr ? hr.status : 'idle'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
            </div>
          </section>

          {/* 2. Mood & Cognitive Stress */}
          <section className="surface-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-berry" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-blueberry">Mood &amp; Cognitive Stress</h2>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-stem">Dominant State</p>
              <p className="text-sm font-bold text-blueberry">{mood?.dominant_mood ?? '--'}</p>
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
                <h2 className="text-sm font-semibold text-blueberry">Sleep &amp; Fatigue</h2>
              </div>
              <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-stem">
                {sleep?.fatigue_level ?? 'Nominal'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
                <p className="text-[11px] text-stem">Blink Rate</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? `${sleep.blink_rate_per_min.toFixed(1)}/m` : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Yawns</p>
                <p className="font-mono text-sm font-semibold text-blueberry">
                  {sleep ? sleep.yawn_count : '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-stem">Sleep State</p>
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
