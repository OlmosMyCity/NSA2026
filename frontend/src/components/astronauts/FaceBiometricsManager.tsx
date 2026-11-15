'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ScanFace,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { astronautService } from '../../services/astronautService';
import type { FaceBiometricSample } from '../../domain/astronauts/types';
import { storageService } from '@/services/storageService';
import { extractBiometricVector } from '@/services/visionService';

interface FaceBiometricsManagerProps {
  astronautId: string;
  astronautName: string;
  onSamplesUpdated?: (count: number) => void;
}

const ANGLE_PRESETS = [
  'Frontal Neutral',
  'Slight Left Turn',
  'Slight Right Turn',
  'Cabin Lighting',
  'Secondary Reference',
];

export function FaceBiometricsManager({
  astronautId,
  astronautName,
  onSamplesUpdated,
}: FaceBiometricsManagerProps) {
  const [samples, setSamples] = useState<FaceBiometricSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>(ANGLE_PRESETS[0]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadSamples = useCallback(async () => {
    if (!astronautId) return;
    try {
      setIsLoading(true);
      const list = await astronautService.listBiometrics(astronautId);
      setSamples(list);
      onSamplesUpdated?.(list.length);
      if (list.length < ANGLE_PRESETS.length) {
        setSelectedLabel(ANGLE_PRESETS[list.length]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load biometric samples.');
    } finally {
      setIsLoading(false);
    }
  }, [astronautId, onSamplesUpdated]);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      setError(
        err instanceof Error ? `Camera access failed: ${err.message}` : 'Could not access webcam.'
      );
    }
  };

  const enrollBlob = async (blob: Blob, fileName: string, labelToUse: string) => {
    setError(null);
    setSuccessMsg(null);
    setIsProcessing(true);
    try {
      // 1. Extract 128D facial embedding via Vision AI (or deterministic browser fallback)
      const extracted = await extractBiometricVector(blob);
      if (!extracted.face_detected || extracted.embedding.length < 16) {
        throw new Error(
          'No clear face detected in the image. Please provide a clear frontal or slightly angled face photo.'
        );
      }

      // 2. Upload image file to storage
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      const imageUrl = await storageService.uploadImage(file, 'astronauts');

      // 3. Save biometric sample and embedding in backend
      const created = await astronautService.enrollBiometric(astronautId, {
        imageUrl,
        label: labelToUse,
        embedding: extracted.embedding,
        qualityScore: extracted.quality_score,
      });

      const nextList = [...samples, created];
      setSamples(nextList);
      onSamplesUpdated?.(nextList.length);
      if (nextList.length < ANGLE_PRESETS.length) {
        setSelectedLabel(ANGLE_PRESETS[nextList.length]);
      }
      setSuccessMsg(
        `Biometric vector enrolled (${extracted.embedding.length}D · Quality ${extracted.quality_score.toFixed(0)}%).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll facial biometric sample.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 5 - samples.length;
    const slice = Array.from(files).slice(0, Math.max(1, remaining));

    for (let i = 0; i < slice.length; i++) {
      const f = slice[i];
      const preset = ANGLE_PRESETS[Math.min(ANGLE_PRESETS.length - 1, samples.length + i)] || selectedLabel;
      await enrollBlob(f, f.name, slice.length === 1 ? selectedLabel : preset);
    }
    e.target.value = '';
  };

  const handleCaptureCamera = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        await enrollBlob(blob, `capture-${Date.now()}.jpg`, selectedLabel);
      },
      'image/jpeg',
      0.88
    );
  };

  const handleDeleteSample = async (sampleId: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await astronautService.deleteBiometric(astronautId, sampleId);
      const next = samples.filter((s) => s.id !== sampleId);
      setSamples(next);
      onSamplesUpdated?.(next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete biometric sample.');
    }
  };

  const canAddMore = samples.length < 5;

  return (
    <section className="rounded-lg border border-line bg-surface-tinted/40 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-berry">
            <ScanFace className="h-4 w-4" aria-hidden="true" />
            <span>Optical Face ID Biometrics</span>
          </div>
          <h3 className="mt-1 text-base font-bold text-blueberry">
            Facial Recognition Profile — {astronautName}
          </h3>
          <p className="mt-0.5 text-xs text-stem">
            Upload or capture 1 to 5 reference photos so Vision AI automatically identifies{' '}
            <strong className="text-blueberry">{astronautName}</strong> in real time and routes
            contactless vitals to their medical record.
          </p>
        </div>

        <span
          className={`rounded-pill border px-3 py-1 font-mono text-xs font-semibold ${
            samples.length > 0
              ? 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] text-status-nominal'
              : 'border-[var(--status-caution-border)] bg-[var(--status-caution-bg)] text-status-caution'
          }`}
        >
          {samples.length}/5 Face Vectors Enrolled
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--status-critical-border)] bg-slate-950/80 p-3 text-xs text-status-critical"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--status-nominal-border)] bg-slate-950/80 p-3 text-xs text-status-nominal">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Enrolled Samples Grid */}
      {isLoading ? (
        <div className="py-4 text-xs text-stem font-mono">Loading enrolled biometric vectors…</div>
      ) : samples.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-5 text-center space-y-1">
          <ScanFace className="mx-auto h-7 w-7 text-stem" />
          <p className="text-xs font-semibold text-blueberry">
            No facial biometric samples enrolled yet
          </p>
          <p className="text-[11px] text-stem">
            Vision AI strict mode requires at least 1 reference face photo to identify this crew
            member on camera.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {samples.map((sample, idx) => (
            <div
              key={sample.id}
              className="group relative overflow-hidden rounded-md border border-line bg-slate-950"
            >
              <div className="aspect-square w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.imageUrl}
                  alt={sample.label || `Face sample ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2 space-y-0.5 bg-surface">
                <p className="truncate text-[11px] font-semibold text-blueberry">
                  {sample.label || `Sample #${idx + 1}`}
                </p>
                <p className="font-mono text-[10px] text-status-nominal">
                  128D · Q {sample.qualityScore.toFixed(0)}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteSample(sample.id)}
                className="tactile-press absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded bg-slate-950/85 text-stem hover:bg-status-critical hover:text-white"
                title="Delete biometric sample"
                aria-label={`Delete ${sample.label || 'sample'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Enrollment Controls */}
      {canAddMore && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs font-medium text-stem">
              <span>Pose / Reference Label</span>
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="twin-select w-auto min-w-[11rem] text-xs font-semibold"
              >
                {ANGLE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>

            <label
              htmlFor={`biometric-upload-${astronautId}`}
              className={`tactile-press inline-flex cursor-pointer items-center gap-2 rounded-sm bg-blueberry px-4 py-2 text-xs font-semibold text-plate hover:bg-berry ${
                isProcessing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>{isProcessing ? 'Extracting 128D Vector…' : 'Upload Face Photo(s)'}</span>
              <input
                id={`biometric-upload-${astronautId}`}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="sr-only"
              />
            </label>

            {!cameraOpen ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={isProcessing}
                className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line bg-surface px-4 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted disabled:opacity-50"
              >
                <Camera className="h-4 w-4 text-berry" />
                <span>Capture with Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-semibold text-stem hover:text-blueberry"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close Camera</span>
              </button>
            )}
          </div>

          {cameraOpen && (
            <div className="rounded-lg border border-line bg-slate-950 p-3 space-y-3">
              <div className="relative mx-auto aspect-[4/3] max-w-md overflow-hidden rounded border border-line bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Tactical Face Framing Guide */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-36 rounded-full border-2 border-dashed border-emerald-400/75 shadow-[0_0_24px_rgba(16,185,129,0.25)]" />
                </div>
                <div className="pointer-events-none absolute bottom-2 inset-x-2 text-center">
                  <span className="rounded bg-slate-950/80 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
                    ALIGN FACE INSIDE OVAL · {selectedLabel.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCaptureCamera}
                  disabled={isProcessing}
                  className="tactile-press inline-flex items-center gap-2 rounded-sm bg-status-nominal px-5 py-2 text-xs font-bold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  <ScanFace className="h-4 w-4" />
                  <span>{isProcessing ? 'Processing Biometrics…' : 'Capture & Enroll Face'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
