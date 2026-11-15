'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { healthService } from '../../services/healthService';
import { evaluateVitals } from '../../domain/health/evaluate';
import { INDICATORS } from '../../domain/health/indicators';
import { API_STATUS } from '../../domain/health/api-adapter';
import type { IndicatorId, Vitals } from '../../domain/health/types';
import { useCrewSelection } from '@/hooks/useCrewSelection';
import {
  VisionBiometricsPanel,
  type OpticalCapturedVitals,
} from '../vision/VisionBiometricsPanel';
import { StatusBadge } from './StatusBadge';
import { AssessmentPanel } from './reading-form/AssessmentPanel';
import { MoodCheckIn } from './reading-form/MoodCheckIn';
import { VitalField } from './reading-form/VitalField';
import { DEFAULT_VITALS } from './reading-form/steps';

const STEP_LABELS = ['1. Optical Scan & Vitals', '2. Review & Confirm'] as const;
const LAST_STEP = STEP_LABELS.length - 1;

const EDITABLE_VITAL_FIELDS: Array<{ indicator: IndicatorId; field: keyof Vitals }> = [
  { indicator: 'heartRate', field: 'heartRateBpm' },
  { indicator: 'sleepHours', field: 'sleepHours' },
  { indicator: 'systolic', field: 'systolicMmHg' },
  { indicator: 'diastolic', field: 'diastolicMmHg' },
  { indicator: 'spo2', field: 'spo2Pct' },
  { indicator: 'temperature', field: 'temperatureC' },
  { indicator: 'glucose', field: 'glucoseMgDl' },
];

type OpticalSyncField = 'heartRateBpm' | 'sleepHours';

export function ReadingFormWizard({ initialAstronautId }: { initialAstronautId?: string }) {
  const router = useRouter();
  const crew = useCrewSelection(initialAstronautId);
  const vitalsSectionRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(true);
  const [vitals, setVitals] = useState<Vitals>(DEFAULT_VITALS);
  const [manuallyEdited, setManuallyEdited] = useState<Partial<Record<OpticalSyncField, boolean>>>({});
  const [opticalSynced, setOpticalSynced] = useState<Partial<Record<OpticalSyncField, boolean>>>({});
  const [latestOptical, setLatestOptical] = useState<OpticalCapturedVitals | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evaluation = useMemo(() => evaluateVitals(vitals), [vitals]);

  const setVital = (field: keyof Vitals) => (value: number) => {
    if (field === 'heartRateBpm' || field === 'sleepHours') {
      setManuallyEdited((prev) => ({ ...prev, [field]: true }));
      setOpticalSynced((prev) => ({ ...prev, [field]: false }));
    }
    setVitals((v) => ({ ...v, [field]: value }));
  };

  const handleApplyOptical = useCallback(
    (captured: OpticalCapturedVitals, options?: { force?: boolean }) => {
      setLatestOptical(captured);
      const force = Boolean(options?.force);

      if (force) {
        setManuallyEdited({});
      }

      setVitals((prev) => {
        const next = { ...prev };
        let changed = false;

        if (
          typeof captured.heartRateBpm === 'number' &&
          (force || !manuallyEdited.heartRateBpm) &&
          prev.heartRateBpm !== captured.heartRateBpm
        ) {
          next.heartRateBpm = captured.heartRateBpm;
          changed = true;
        }

        if (
          typeof captured.sleepHours === 'number' &&
          (force || !manuallyEdited.sleepHours) &&
          prev.sleepHours !== captured.sleepHours
        ) {
          next.sleepHours = captured.sleepHours;
          changed = true;
        }

        return changed ? next : prev;
      });

      setOpticalSynced((prev) => ({
        heartRateBpm:
          typeof captured.heartRateBpm === 'number' && (force || !manuallyEdited.heartRateBpm)
            ? true
            : prev.heartRateBpm,
        sleepHours:
          typeof captured.sleepHours === 'number' && (force || !manuallyEdited.sleepHours)
            ? true
            : prev.sleepHours,
      }));
    },
    [manuallyEdited.heartRateBpm, manuallyEdited.sleepHours],
  );

  const handleResyncField = (field: OpticalSyncField) => {
    if (!latestOptical) return;
    setManuallyEdited((prev) => ({ ...prev, [field]: false }));
    const opticalValue = latestOptical[field];
    if (typeof opticalValue === 'number') {
      setVitals((prev) => ({ ...prev, [field]: opticalValue }));
      setOpticalSynced((prev) => ({ ...prev, [field]: true }));
    }
  };

  const handleSkipToManual = () => {
    setScannerOpen(false);
    requestAnimationFrame(() => {
      vitalsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const goTo = (next: number) => {
    setErrorMessage(null);
    const clamped = Math.min(LAST_STEP, Math.max(0, next));
    if (clamped > 0) {
      for (const { indicator, field } of EDITABLE_VITAL_FIELDS) {
        const val = vitals[field];
        const def = INDICATORS[indicator];
        if (!Number.isFinite(val) || val < def.input.min || val > def.input.max) {
          setErrorMessage(
            `${def.label} must be between ${def.input.min} and ${def.input.max} ${def.unit}.`,
          );
          return;
        }
      }
    }
    setStep(clamped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!crew.selectedId) {
      setErrorMessage('Please select the astronaut for this reading.');
      return;
    }
    try {
      setIsSubmitting(true);
      await healthService.createReading({
        astronautId: crew.selectedId,
        ...vitals,
        notes: notes.trim() || null,
      });
      router.push('/dashboard?recorded=true');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to log telemetry to the system.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSyncBadge = (field: keyof Vitals) => {
    if (field !== 'heartRateBpm' && field !== 'sleepHours') return null;

    if (manuallyEdited[field]) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-stem">
          <span>Edited manually</span>
          {latestOptical?.[field] !== undefined && (
            <button
              type="button"
              onClick={() => handleResyncField(field)}
              className="inline-flex items-center gap-0.5 font-semibold text-berry hover:text-blueberry underline underline-offset-2"
            >
              <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Re-sync</span>
            </button>
          )}
        </span>
      );
    }

    if (opticalSynced[field]) {
      return (
        <span className="inline-flex items-center rounded-pill border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] px-2 py-0.5 text-[10px] font-semibold text-status-nominal">
          Optical Scan synced · editable
        </span>
      );
    }

    return null;
  };

  return (
    <div className="surface-card mx-auto max-w-4xl p-6 sm:p-10">
      <div className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            Log Vital Signs
          </h1>
          <StatusBadge status={API_STATUS[evaluation.status]} />
        </div>
        <p className="mt-1.5 text-sm text-stem">
          Start with an optical scan to auto-fill pulse and sleep telemetry, review or modify any
          value manually below, and complete the behavioral check-in.
        </p>

        <div className="mt-6 flex flex-wrap gap-6 border-b border-line text-xs font-semibold">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(i)}
              className={`-mb-px border-b-2 pb-3 text-left transition-colors ${
                step === i
                  ? 'border-plate text-blueberry'
                  : step > i
                    ? 'border-transparent text-status-nominal hover:text-blueberry'
                    : 'border-transparent text-stem hover:text-blueberry'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(crew.canChoose || !crew.selected) && (
        <div className="mt-6">
          <label htmlFor="select-astronaut" className="block text-xs font-semibold text-blueberry">
            Monitored Crew Member *
          </label>
          {crew.canChoose ? (
            <select
              id="select-astronaut"
              value={crew.selectedId ?? ''}
              onChange={(e) => crew.setSelectedId(e.target.value)}
              className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
            >
              {crew.options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>
          ) : (
            <p id="select-astronaut" className="mt-2 border-b border-line py-2 text-sm text-blueberry">
              {crew.isLoading
                ? 'Loading crew profile…'
                : 'Your account is not linked to a crew member yet. Ask the Flight Surgeon to add you to a crew.'}
            </p>
          )}
          {crew.error && <p className="mt-2 text-xs text-status-critical">{crew.error}</p>}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-status-critical pl-4 py-1 flex items-start gap-2.5 text-xs text-status-critical"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {step === 0 ? (
          <div className="space-y-8 animate-materialize">
            {/* Optical Scan First (Collapsible / Optional) */}
            {scannerOpen ? (
              <VisionBiometricsPanel
                embedded
                onApplyVitals={handleApplyOptical}
                onSkipToManual={handleSkipToManual}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-tinted/35 px-4 py-3">
                <div className="text-xs text-stem">
                  <strong className="font-semibold text-blueberry">Manual entry mode active</strong>
                  {' · '}Optical Scan camera paused. Enter or adjust all parameters below.
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-blueberry px-3.5 py-1.5 text-xs font-semibold text-plate hover:bg-berry"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Optical Scan</span>
                </button>
              </div>
            )}

            {/* Editable Vitals Grid */}
            <div ref={vitalsSectionRef} className="space-y-6">
              <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
                <Activity className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blueberry/90 leading-relaxed">
                  <strong className="text-blueberry block font-semibold mb-0.5">
                    Vital Signs &amp; Cabin Measurements (All Fields Editable)
                  </strong>
                  Verify or manually enter your physiological readings. Heart rate and sleep duration
                  auto-update from the optical scan until edited manually.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {EDITABLE_VITAL_FIELDS.map(({ indicator, field }) => (
                  <VitalField
                    key={field}
                    indicator={indicator}
                    value={vitals[field]}
                    onChange={setVital(field)}
                    badge={renderSyncBadge(field)}
                  />
                ))}
              </div>
            </div>

            {/* Behavioral & Mood Check-In Questions */}
            <div className="border-t border-line pt-6">
              <MoodCheckIn value={vitals.mood} onChange={setVital('mood')} />
            </div>

            {/* Optional Observations */}
            <div>
              <label htmlFor="notes" className="block text-xs font-semibold text-blueberry">
                EVA Observations or Symptoms (optional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Mild headache post-EVA, 0.166g acclimation nominal..."
                className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry placeholder-stem/60 focus:border-blueberry focus:outline-none resize-none"
              />
            </div>
          </div>
        ) : (
          <AssessmentPanel
            evaluation={evaluation}
            vitals={vitals}
            astronautName={crew.selected?.name}
          />
        )}

        {step === LAST_STEP && (
          <p className="flex items-start gap-2 text-[11px] text-stem">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            Preview computed onboard with the same clinical thresholds the server applies when saving.
          </p>
        )}

        <div className="flex items-center justify-between pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="tactile-press flex items-center gap-1.5 py-2 text-xs font-semibold text-stem hover:text-blueberry"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Scan &amp; Vitals</span>
            </button>
          ) : (
            <div />
          )}

          {step < LAST_STEP ? (
            <button
              key="next"
              type="button"
              onClick={() => goTo(step + 1)}
              className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-6 py-2.5 text-xs font-semibold text-plate hover:bg-berry"
            >
              <span>Review Assessment</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={isSubmitting || !crew.selectedId}
              className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-7 py-3 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-plate border-t-transparent" />
                  <span>Transmitting telemetry...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm &amp; Save Reading</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
