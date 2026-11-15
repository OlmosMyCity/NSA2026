'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Brain,
  Camera,
  CheckCircle2,
  Eye,
  HeartPulse,
  Keyboard,
  Lock,
  Moon,
  RefreshCw,
  ScanFace,
  Upload,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useActiveAstronaut } from '@/hooks/useActiveAstronaut';
import { astronautService } from '@/services/astronautService';
import type {
  AstronautTelemetryFrame,
  CameraMode,
  EnrolledCrewProfile,
  MonitoringContext,
  VisionSource,
} from '../../domain/vision/types';
import {
  analyzeWebcamFrameHttp,
  checkVisionHealth,
  getVisionWsUrl,
  ingestVisionTelemetry,
  resetVisionHttp,
  syncVisionGalleryHttp,
} from '../../services/visionService';
import { MockVisionSimulator } from '../../mocks/visionMock';
import { ENV } from '@/config/env';

const SYNC_INTERVAL_MS = 30_000;
const DEFAULT_CAMERA_MODE: CameraMode = 'rgb_pos';

export interface OpticalCapturedVitals {
  heartRateBpm?: number;
  sleepHours?: number;
  stressIndex?: number;
  perclos?: number;
  heartRateSignalQuality?: number;
  dominantMood?: string;
}

export interface VisionBiometricsPanelProps {
  embedded?: boolean;
  onApplyVitals?: (captured: OpticalCapturedVitals, options?: { force?: boolean }) => void;
  onSkipToManual?: () => void;
}

function buildCapturedVitals(frame: AstronautTelemetryFrame): OpticalCapturedVitals {
  const captured: OpticalCapturedVitals = {
    stressIndex: frame.mood?.stress_index,
    perclos: frame.sleep?.perclos,
    heartRateSignalQuality: frame.heart_rate?.signal_quality,
    dominantMood: frame.mood?.dominant_mood,
  };
  if (frame.heart_rate.bpm > 0 && Number.isFinite(frame.heart_rate.bpm)) {
    captured.heartRateBpm = Math.min(220, Math.max(20, Math.round(frame.heart_rate.bpm)));
  }
  if (
    typeof frame.sleep?.sleep_quality_score === 'number' &&
    Number.isFinite(frame.sleep.sleep_quality_score)
  ) {
    const score = Math.min(100, Math.max(0, frame.sleep.sleep_quality_score));
    captured.sleepHours = Number((4 + (score / 100) * 4.5).toFixed(1));
  }
  return captured;
}

export function VisionBiometricsPanel({
  embedded = false,
  onApplyVitals,
  onSkipToManual,
}: VisionBiometricsPanelProps = {}) {
  const { astronautId, setAstronautId, crew } = useActiveAstronaut();

  const [source] = useState<VisionSource>('webcam');
  const [context, setContext] = useState<MonitoringContext>('cabin_active');
  const [streaming, setStreaming] = useState<boolean>(true);

  const [wsStatus, setWsStatus] = useState<
    'connecting' | 'connected' | 'http-live' | 'mock-live' | 'offline'
  >('connecting');
  const [telemetry, setTelemetry] = useState<AstronautTelemetryFrame | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const [enrolledProfiles, setEnrolledProfiles] = useState<EnrolledCrewProfile[]>([]);
  const [isIngestingNow, setIsIngestingNow] = useState<boolean>(false);
  const [lastIngestInfo, setLastIngestInfo] = useState<{
    astronautName: string;
    time: string;
    bpm: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mockSimRef = useRef<MockVisionSimulator | null>(null);
  const awaitingRef = useRef<boolean>(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Latest refs for intervals and 60fps canvas animation loop
  const latestTelemetryRef = useRef<AstronautTelemetryFrame | null>(null);
  const astronautIdRef = useRef<string | undefined>(astronautId);
  const crewRef = useRef(crew);
  const enrolledProfilesRef = useRef<EnrolledCrewProfile[]>([]);
  const sourceRef = useRef<VisionSource>(source);
  const contextRef = useRef<MonitoringContext>(context);
  const streamingRef = useRef<boolean>(streaming);

  useEffect(() => {
    astronautIdRef.current = astronautId;
    if (mockSimRef.current) {
      mockSimRef.current.setGallery(enrolledProfilesRef.current, astronautId);
    }
  }, [astronautId]);

  useEffect(() => {
    crewRef.current = crew;
  }, [crew]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Load mission facial biometric gallery and push to Vision AI
  const loadGallery = useCallback(async () => {
    try {
      const gallery = await astronautService.getBiometricGallery();
      const formatted: EnrolledCrewProfile[] = gallery
        .filter((g) => g.embeddings && g.embeddings.length > 0)
        .map((g) => ({
          astronaut_id: g.astronautId,
          astronaut_name: g.astronautName,
          role: g.role,
          embeddings: g.embeddings,
        }));
      enrolledProfilesRef.current = formatted;
      setEnrolledProfiles(formatted);

      void syncVisionGalleryHttp(formatted);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'sync_gallery',
            profiles: formatted,
          })
        );
      }
      if (mockSimRef.current) {
        mockSimRef.current.setGallery(formatted, astronautIdRef.current);
      }
    } catch {
      // Non-fatal if gallery cannot be fetched yet
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  // Auto-select recognized crew member when Vision AI matches a face
  useEffect(() => {
    const idMetrics = telemetry?.identity;
    if (idMetrics?.recognized && idMetrics.astronaut_id) {
      if (astronautId !== idMetrics.astronaut_id) {
        setAstronautId(idMetrics.astronaut_id);
      }
    }
  }, [telemetry?.identity, astronautId, setAstronautId]);

  // 60 FPS Smooth Interpolated YOLO Bounding Box & Identity Overlay
  useEffect(() => {
    let animId = 0;
    let curBox: [number, number, number, number] | null = null;
    let boxAlpha = 0;

    const renderHud = () => {
      const canvas = hudCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx && targetW > 0 && targetH > 0) {
          ctx.save();
          ctx.scale(dpr, dpr);
          const w = rect.width;
          const h = rect.height;
          ctx.clearRect(0, 0, w, h);

          const frame = latestTelemetryRef.current;
          const faceDetected = Boolean(frame?.face_detected);
          const rawNorm = frame?.identity?.bbox_norm;
          const targetNorm: [number, number, number, number] | null =
            faceDetected && rawNorm && rawNorm.length === 4
              ? [rawNorm[0], rawNorm[1], rawNorm[2], rawNorm[3]]
              : faceDetected
                ? [0.31, 0.15, 0.38, 0.66]
                : null;

          if (targetNorm) {
            boxAlpha = Math.min(1, boxAlpha + 0.12);
            if (!curBox) {
              curBox = [...targetNorm];
            } else {
              // Exponential lerp at 60Hz for buttery-smooth YOLO tracking
              const k = 0.24;
              curBox[0] += (targetNorm[0] - curBox[0]) * k;
              curBox[1] += (targetNorm[1] - curBox[1]) * k;
              curBox[2] += (targetNorm[2] - curBox[2]) * k;
              curBox[3] += (targetNorm[3] - curBox[3]) * k;
            }
          } else {
            boxAlpha = Math.max(0, boxAlpha - 0.1);
            if (boxAlpha <= 0.01) curBox = null;
          }

          if (curBox && boxAlpha > 0.02 && frame) {
            const bx = curBox[0] * w;
            const by = curBox[1] * h;
            const bw = curBox[2] * w;
            const bh = curBox[3] * h;

            const id = frame.identity;
            const isRecognized = Boolean(id?.recognized && id?.astronaut_name);
            const mainColor = isRecognized
              ? 'rgba(52, 211, 153, 0.95)' // Emerald nominal
              : 'rgba(251, 191, 36, 0.95)'; // Amber caution (locked)
            const fillTint = isRecognized
              ? 'rgba(16, 185, 129, 0.07)'
              : 'rgba(245, 158, 11, 0.07)';

            ctx.globalAlpha = boxAlpha;

            // Subtle YOLO box fill + outer frame
            ctx.fillStyle = fillTint;
            ctx.fillRect(bx, by, bw, bh);

            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);

            // Bold YOLO Tactical Corner Brackets
            const cornerLen = Math.max(14, Math.min(bw, bh) * 0.14);
            ctx.lineWidth = 3;
            ctx.beginPath();
            // Top-left
            ctx.moveTo(bx, by + cornerLen);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + cornerLen, by);
            // Top-right
            ctx.moveTo(bx + bw - cornerLen, by);
            ctx.lineTo(bx + bw, by);
            ctx.lineTo(bx + bw, by + cornerLen);
            // Bottom-left
            ctx.moveTo(bx, by + bh - cornerLen);
            ctx.lineTo(bx, by + bh);
            ctx.lineTo(bx + cornerLen, by + bh);
            // Bottom-right
            ctx.moveTo(bx + bw - cornerLen, by + bh);
            ctx.lineTo(bx + bw, by + bh);
            ctx.lineTo(bx + bw, by + bh - cornerLen);
            ctx.stroke();

            // YOLO Top Label Banner
            const bpmTxt =
              frame.heart_rate.bpm > 0 ? `${frame.heart_rate.bpm.toFixed(0)} BPM` : 'CALIB';
            const labelText = isRecognized
              ? `${id!.astronaut_name!.toUpperCase()} · ${id!.confidence.toFixed(1)}% | ${bpmTxt}`
              : (id?.enrolled_count ?? 0) === 0
                ? 'NO FACE ID ENROLLED · INGESTION LOCKED'
                : 'UNRECOGNIZED SUBJECT · INGESTION LOCKED';

            ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
            const textMetrics = ctx.measureText(labelText);
            const pillW = textMetrics.width + 16;
            const pillH = 22;
            const pillX = Math.max(6, Math.min(w - pillW - 6, bx));
            const pillY = by > pillH + 8 ? by - pillH - 4 : by + 4;

            ctx.fillStyle = isRecognized
              ? 'rgba(6, 78, 59, 0.92)'
              : 'rgba(120, 53, 15, 0.92)';
            ctx.fillRect(pillX, pillY, pillW, pillH);
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(pillX, pillY, pillW, pillH);

            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, pillX + 8, pillY + pillH / 2);
          }

          ctx.restore();
        }
      }
      animId = requestAnimationFrame(renderHud);
    };

    animId = requestAnimationFrame(renderHud);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Manage local webcam stream when source === 'webcam'
  useEffect(() => {
    let cancelled = false;

    async function enableWebcam() {
      setWebcamError(null);
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setWebcamError(
          'Camera blocked: the browser only allows cameras on https:// or http://localhost.'
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setWebcamError('This browser does not support camera capture.');
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
          setWebcamError(`Could not access local camera: ${reason}.`);
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
      if (!mockSimRef.current) {
        mockSimRef.current = new MockVisionSimulator();
        mockSimRef.current.setGallery(enrolledProfilesRef.current, astronautIdRef.current);
      }
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
        void syncVisionGalleryHttp(enrolledProfilesRef.current);
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
        void syncVisionGalleryHttp(enrolledProfilesRef.current);
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
        if (enrolledProfilesRef.current.length > 0) {
          ws.send(
            JSON.stringify({
              type: 'sync_gallery',
              profiles: enrolledProfilesRef.current,
            })
          );
        }
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
          sim_bpm: 72,
          sim_state: 'nominal',
        });
        latestTelemetryRef.current = frame;
        setTelemetry(frame);
        return;
      }

      if (mode === 'ws') {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

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
        return;
      }

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

  /**
   * Strict Ingestion by Facial Recognition:
   * Only persists telemetry when the subject in front of the sensor is positively
   * recognized against an enrolled crew member's facial biometric profile.
   */
  const syncTelemetry = useCallback(async () => {
    const frame = latestTelemetryRef.current;
    if (!frame || isSyncingRef.current) return;

    const recognizedId = frame.identity?.recognized ? frame.identity.astronaut_id : null;
    if (!recognizedId) return;

    isSyncingRef.current = true;
    setIsIngestingNow(true);
    try {
      const res = await ingestVisionTelemetry(recognizedId, frame);
      const matchedName =
        frame.identity?.astronaut_name ||
        crewRef.current.find((c) => c.id === recognizedId)?.name ||
        recognizedId;
      setLastIngestInfo({
        astronautName: matchedName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        bpm: res.derivedVitals.heartRateBpm,
      });
    } catch {
      // Background telemetry persistence failure does not block live view
    } finally {
      isSyncingRef.current = false;
      setIsIngestingNow(false);
    }
  }, []);

  // Silent background persistence every 30s ONLY when face is recognized
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      void syncTelemetry();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [streaming, syncTelemetry]);

  const onApplyVitalsRef = useRef(onApplyVitals);
  useEffect(() => {
    onApplyVitalsRef.current = onApplyVitals;
  }, [onApplyVitals]);

  useEffect(() => {
    if (!telemetry || !onApplyVitalsRef.current) return;
    onApplyVitalsRef.current(buildCapturedVitals(telemetry));
  }, [telemetry]);

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
  const identity = telemetry?.identity;
  const isRecognized = Boolean(identity?.recognized && identity?.astronaut_id);
  const isLive = wsStatus === 'connected' || wsStatus === 'http-live' || wsStatus === 'mock-live';
  const capturedSummary = telemetry ? buildCapturedVitals(telemetry) : null;

  return (
    <div className={embedded ? 'space-y-4 rounded-lg border border-line bg-surface-tinted/35 p-4 sm:p-5' : 'space-y-6'}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blueberry">
              <Video className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              <span>Optical Biometric Scan</span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${
                isLive
                  ? 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] text-status-nominal'
                  : wsStatus === 'connecting'
                    ? 'border-[var(--status-caution-border)] bg-[var(--status-caution-bg)] text-status-caution'
                    : 'border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-status-critical'
              }`}
            >
              {isLive ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              <span>
                {isLive
                  ? 'Sensor Active'
                  : wsStatus === 'connecting'
                    ? 'Connecting Sensor…'
                    : 'Sensor Standby'}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSkipToManual && (
              <button
                type="button"
                onClick={onSkipToManual}
                className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
              >
                <Keyboard className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                <span>Fill manually without camera</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header & Controls */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-berry">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Contactless Optical Biometrics · Face ID Routing</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
                Crew Optical Biometrics &amp; Fatigue
              </h1>
              <p className="mt-1 text-xs text-stem">
                Real-time YOLO face recognition automatically routes contactless vitals to the
                identified crew member.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/profile"
                className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
              >
                <ScanFace className="h-3.5 w-3.5 text-berry" />
                <span>Manage Face ID ({enrolledProfiles.length} enrolled)</span>
              </Link>

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

          {/* Strict Facial Recognition Status Banner */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border px-4 py-3 text-xs backdrop-blur-md ${
              isRecognized
                ? 'border-[var(--status-nominal-border)] bg-emerald-950/35 text-status-nominal'
                : 'border-[var(--status-caution-border)] bg-amber-950/35 text-status-caution'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isRecognized ? (
                <ScanFace className="h-4 w-4 shrink-0 text-status-nominal" />
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-status-caution" />
              )}
              <div>
                {isRecognized ? (
                  <p className="font-semibold">
                    Identified Subject:{' '}
                    <strong className="underline underline-offset-2">{identity?.astronaut_name}</strong>{' '}
                    <span className="font-mono">({identity?.confidence.toFixed(1)}% match)</span> —
                    Strict Ingestion Unlocked
                  </p>
                ) : enrolledProfiles.length === 0 ? (
                  <p className="font-semibold">
                    Strict Mode Active: No crew facial biometrics enrolled yet. Ingestion is locked
                    until at least 1 crew member enrolls Face ID.
                  </p>
                ) : (
                  <p className="font-semibold">
                    Strict Mode Active: Subject in camera does not match any enrolled crew Face ID.
                    Ingestion is paused to prevent misattribution.
                  </p>
                )}
                {lastIngestInfo && (
                  <p className="mt-0.5 text-[11px] text-stem font-mono">
                    Last ingested reading: {lastIngestInfo.astronautName} ({lastIngestInfo.bpm} BPM) at{' '}
                    {lastIngestInfo.time}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isRecognized ? (
                <button
                  type="button"
                  onClick={() => void syncTelemetry()}
                  disabled={isIngestingNow}
                  className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-status-nominal px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isIngestingNow ? (
                    <span>Ingesting…</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Ingest to {identity?.astronaut_name} Now</span>
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href="/profile"
                  className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-blueberry px-3.5 py-1.5 text-xs font-semibold text-plate hover:bg-berry"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Enroll Crew Face Photos</span>
                </Link>
              )}
            </div>
          </div>
        </>
      )}

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

          {/* Sensor Feed Viewport with 60 FPS Interpolated YOLO Canvas Overlay */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-slate-950">
            <video
              ref={webcamVideoRef}
              autoPlay
              playsInline
              muted
              className="block h-full w-full object-cover"
            />

            {/* 60 FPS Smooth YOLO Detection & Identity Canvas */}
            <canvas
              ref={hudCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-pill border px-2.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md ${
                    isRecognized
                      ? 'border-[var(--status-nominal-border)] bg-slate-950/75 text-status-nominal'
                      : 'border-[var(--status-caution-border)] bg-slate-950/75 text-status-caution'
                  }`}
                >
                  {isRecognized
                    ? `ID LOCKED: ${identity?.astronaut_name?.toUpperCase()}`
                    : telemetry?.face_detected
                      ? 'UNVERIFIED SUBJECT · LOCKED'
                      : 'SCANNING SUBJECT...'}
                </span>
                {telemetry && (
                  <span className="rounded-pill border border-line bg-slate-950/75 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-blueberry backdrop-blur-md">
                    {telemetry.heart_rate.bpm > 0
                      ? `${telemetry.heart_rate.bpm.toFixed(0)} BPM`
                      : 'CALIBRATING'}{' '}
                    · {telemetry.mood.dominant_mood}
                  </span>
                )}
              </div>
              {telemetry && (
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-blueberry">
                  <span className="rounded bg-slate-950/75 px-2 py-0.5 backdrop-blur-md">
                    STRESS {telemetry.mood.stress_index.toFixed(0)}% · PERCLOS{' '}
                    {telemetry.sleep.perclos.toFixed(1)}%
                  </span>
                  <span className="rounded bg-slate-950/75 px-2 py-0.5 backdrop-blur-md">
                    {isRecognized ? 'AUTO-INGEST: ARMED' : 'AUTO-INGEST: PAUSED'}
                  </span>
                </div>
              )}
            </div>
            <canvas ref={captureCanvasRef} width={384} height={288} className="hidden" />
          </div>

          {/* Context Controls */}
          <div className="grid gap-3">
            <label className="space-y-1 text-[11px] font-medium text-stem">
              <span>Mission Context</span>
              <select
                value={context}
                onChange={(e) => {
                  setContext(e.target.value as MonitoringContext);
                  handleResetPipeline();
                }}
                className="twin-select font-semibold"
              >
                <option value="cabin_active">Cabin Active</option>
                <option value="sleep_pod">Sleep Pod</option>
              </select>
            </label>
          </div>
        </div>

        {/* Right: Biometric Telemetry Cards (Compact Sync Card when embedded) */}
        {embedded ? (
          <div className="space-y-4">
            <section className="surface-card space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-status-critical" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-blueberry">Live Optical Readout</h2>
                </div>
                <span className="rounded-pill bg-surface-tinted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-stem">
                  {hr ? hr.status : 'calibrating'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-line/70 bg-surface-tinted/35 p-3">
                  <p className="text-[11px] text-stem">Detected Heart Rate</p>
                  <p className="mt-1 font-mono text-xl font-bold text-blueberry tabular-nums">
                    {capturedSummary?.heartRateBpm ?? '--'}
                    <span className="ml-1 text-[11px] font-normal text-stem">BPM</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-stem font-mono">
                    HRV {hr ? `${hr.hrv_rmssd_ms.toFixed(0)} ms` : '--'} · Resp{' '}
                    {hr ? `${hr.respiration_rpm.toFixed(0)} rpm` : '--'}
                  </p>
                </div>

                <div className="rounded-md border border-line/70 bg-surface-tinted/35 p-3">
                  <p className="text-[11px] text-stem">Estimated Sleep (24h)</p>
                  <p className="mt-1 font-mono text-xl font-bold text-blueberry tabular-nums">
                    {capturedSummary?.sleepHours !== undefined
                      ? capturedSummary.sleepHours.toFixed(1)
                      : '--'}
                    <span className="ml-1 text-[11px] font-normal text-stem">h</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-stem font-mono">
                    PERCLOS {sleep ? `${sleep.perclos.toFixed(1)}%` : '--'} ·{' '}
                    {sleep?.fatigue_level ?? 'Nominal'}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-line/70 bg-surface-tinted/20 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stem">Cognitive State</span>
                  <span className="font-semibold text-blueberry">
                    {mood?.dominant_mood ?? '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-stem">
                  <span>Stress: {mood ? `${mood.stress_index.toFixed(0)}%` : '--'}</span>
                  <span>Alertness: {mood ? `${mood.alertness_score.toFixed(0)}%` : '--'}</span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-stem">
                Detected heart rate and sleep duration sync automatically into the editable fields
                below. You can review or overwrite any number before saving.
              </p>

              <button
                type="button"
                disabled={!capturedSummary}
                onClick={() => capturedSummary && onApplyVitals?.(capturedSummary, { force: true })}
                className="tactile-press inline-flex w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                <span>Apply Scanned Values to Fields Below</span>
              </button>
            </section>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
