'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { evaluateIndicator, evaluateVitals } from '../../domain/health/evaluate';
import { clearFollowUpNote, saveFollowUpNote } from '../../domain/health/followUpStorage';
import { INDICATORS } from '../../domain/health/indicators';
import { getMedicalProtocolsForAlerts } from '../../domain/health/medicalProtocols';
import { API_STATUS } from '../../domain/health/api-adapter';
import type { IndicatorId, Vitals } from '../../domain/health/types';
import { useAuth } from '@/context/AuthContext';
import { useCrewSelection } from '@/hooks/useCrewSelection';
import {
  VisionBiometricsPanel,
  type OpticalCapturedVitals,
} from '../vision/VisionBiometricsPanel';
import { StatusBadge } from './StatusBadge';
import { AssessmentPanel, type CriticalVerificationPhase } from './reading-form/AssessmentPanel';
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

const EVALUATED_FIELDS: Array<{ indicator: IndicatorId; field: keyof Vitals }> = [
  ...EDITABLE_VITAL_FIELDS,
  { indicator: 'mood', field: 'mood' },
];

type OpticalSyncField = 'heartRateBpm' | 'sleepHours';

export function ReadingFormWizard({
  initialAstronautId,
  initialStep = 0,
}: {
  initialAstronautId?: string;
  initialStep?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const ownerUserId = user?.id ?? null;
  const crew = useCrewSelection(initialAstronautId);
  const vitalsSectionRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState(initialStep);
  const [scannerOpen, setScannerOpen] = useState(true);
  const [vitals, setVitals] = useState<Vitals>(DEFAULT_VITALS);
  const [manuallyEdited, setManuallyEdited] = useState<Partial<Record<OpticalSyncField, boolean>>>({});
  const [opticalSynced, setOpticalSynced] = useState<Partial<Record<OpticalSyncField, boolean>>>({});
  const [latestOptical, setLatestOptical] = useState<OpticalCapturedVitals | null>(null);
  const [notes, setNotes] = useState('');
  const [verificationPhase, setVerificationPhase] = useState<CriticalVerificationPhase>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefilledFromLog, setPrefilledFromLog] = useState(false);
  const userTouchedVitalsRef = useRef(false);
  const checkedStepsRef = useRef<Record<string, boolean>>({});
  const handleCheckedStepsChange = useCallback((steps: Record<string, boolean>) => {
    checkedStepsRef.current = steps;
  }, []);

  // Scroll to top whenever switching between wizard steps (e.g. Optical Scan -> Review)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  // Pre-fill vitals from the astronaut's latest valid reading (fallback to DEFAULT_VITALS)
  useEffect(() => {
    const selectedId = crew.selectedId;
    if (!selectedId) return;
    let cancelled = false;
    userTouchedVitalsRef.current = false;
    setPrefilledFromLog(false);

    (async () => {
      try {
        const rows = await healthService.listReadings(selectedId);
        if (cancelled || userTouchedVitalsRef.current) return;

        if (!rows || rows.length === 0) {
          setVitals(DEFAULT_VITALS);
          setManuallyEdited({});
          setOpticalSynced({});
          setVerificationPhase('idle');
          return;
        }

        const latest = rows.reduce((best, cur) =>
          Date.parse(cur.takenAt) >= Date.parse(best.takenAt) ? cur : best,
        );

        setVitals({
          heartRateBpm: Number.isFinite(latest.heartRateBpm) ? latest.heartRateBpm : DEFAULT_VITALS.heartRateBpm,
          systolicMmHg: Number.isFinite(latest.systolicMmHg) ? latest.systolicMmHg : DEFAULT_VITALS.systolicMmHg,
          diastolicMmHg: Number.isFinite(latest.diastolicMmHg) ? latest.diastolicMmHg : DEFAULT_VITALS.diastolicMmHg,
          glucoseMgDl: Number.isFinite(latest.glucoseMgDl) ? latest.glucoseMgDl : DEFAULT_VITALS.glucoseMgDl,
          temperatureC: Number.isFinite(latest.temperatureC) ? latest.temperatureC : DEFAULT_VITALS.temperatureC,
          spo2Pct: Number.isFinite(latest.spo2Pct) ? latest.spo2Pct : DEFAULT_VITALS.spo2Pct,
          sleepHours: Number.isFinite(latest.sleepHours) ? latest.sleepHours : DEFAULT_VITALS.sleepHours,
          mood: Number.isFinite(latest.mood) ? latest.mood : DEFAULT_VITALS.mood,
        });
        setManuallyEdited({});
        setOpticalSynced({});
        setVerificationPhase('idle');
        setPrefilledFromLog(true);
      } catch {
        if (!cancelled && !userTouchedVitalsRef.current) {
          setVitals(DEFAULT_VITALS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crew.selectedId]);

  const evaluation = useMemo(() => evaluateVitals(vitals), [vitals]);
  const criticalLocked = evaluation.status === 'CRITICAL' && verificationPhase === 'idle';

  const nominalCount = useMemo(
    () =>
      EVALUATED_FIELDS.filter(
        ({ indicator, field }) =>
          Number.isFinite(vitals[field]) && evaluateIndicator(indicator, vitals[field]).status === 'green',
      ).length,
    [vitals],
  );

  const setVital = (field: keyof Vitals) => (value: number) => {
    userTouchedVitalsRef.current = true;
    if (field === 'heartRateBpm' || field === 'sleepHours') {
      setManuallyEdited((prev) => ({ ...prev, [field]: true }));
      setOpticalSynced((prev) => ({ ...prev, [field]: false }));
    }
    setVerificationPhase('idle');
    setVitals((v) => ({ ...v, [field]: value }));
  };

  const handleApplyOptical = useCallback(
    (captured: OpticalCapturedVitals, options?: { force?: boolean }) => {
      userTouchedVitalsRef.current = true;
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

  const validateVitals = (): string | null => {
    for (const { indicator, field } of EDITABLE_VITAL_FIELDS) {
      const val = vitals[field];
      const def = INDICATORS[indicator];
      if (!Number.isFinite(val) || val < def.input.min || val > def.input.max) {
        return `${def.label} must be between ${def.input.min} and ${def.input.max} ${def.unit}.`;
      }
    }
    return null;
  };

  const goTo = (next: number) => {
    setErrorMessage(null);
    const clamped = Math.min(LAST_STEP, Math.max(0, next));
    if (clamped > 0) {
      const invalid = validateVitals();
      if (invalid) {
        setErrorMessage(invalid);
        return;
      }
    }
    setStep(clamped);
  };

  const handleApplyRecheck = (updatedVitals: Vitals) => {
    setErrorMessage(null);
    for (const { indicator, field } of EDITABLE_VITAL_FIELDS) {
      const val = updatedVitals[field];
      const def = INDICATORS[indicator];
      if (!Number.isFinite(val) || val < def.input.min || val > def.input.max) {
        setErrorMessage(
          `${def.label} must be between ${def.input.min} and ${def.input.max} ${def.unit}.`,
        );
        return;
      }
    }
    setVitals(updatedVitals);
    const reEval = evaluateVitals(updatedVitals);
    setVerificationPhase(reEval.status === 'CRITICAL' ? 'confirmed_critical' : 'stabilized');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      goTo(1);
      return;
    }
    setErrorMessage(null);
    const invalid = validateVitals();
    if (invalid) {
      setErrorMessage(invalid);
      return;
    }
    if (!crew.selectedId) {
      setErrorMessage('Please select the astronaut for this reading.');
      return;
    }
    if (criticalLocked) {
      setErrorMessage(
        'Complete the immediate stabilization checklist and verification re-check (or select emergency bypass) before saving.',
      );
      return;
    }

    const phaseTag =
      verificationPhase === 'confirmed_critical'
        ? '[Confirmed CRITICAL after stabilization re-check]'
        : verificationPhase === 'emergency_bypass'
          ? '[Emergency bypass — immediate triage]'
          : verificationPhase === 'stabilized'
            ? '[Verified stabilized after re-check]'
            : '';
    const trimmedNotes = notes.trim();
    const combinedNotes = [trimmedNotes, phaseTag].filter(Boolean).join(' · ') || null;

    try {
      setIsSubmitting(true);
      await healthService.createReading({
        astronautId: crew.selectedId,
        ...vitals,
        notes: combinedNotes,
      });

      if (evaluation.status === 'WARNING') {
        const protocols = getMedicalProtocolsForAlerts(evaluation.alerts);
        const primary = protocols[0];
        const items = (primary?.steps ?? []).slice(0, 3).map((s, idx) => {
          const id = `${primary?.protocolId ?? 'warn'}-${idx}`;
          return {
            id,
            text: s.action,
            howTo: s.howTo,
            done: Boolean(checkedStepsRef.current[id]),
          };
        });
        if (items.length > 0) {
          saveFollowUpNote({
            ownerUserId,
            astronautId: crew.selectedId,
            astronautName: crew.selected?.name,
            title: primary?.title ?? 'Caution Follow-Up Check',
            items,
          });
        }
      } else {
        clearFollowUpNote(crew.selectedId, ownerUserId);
      }

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
              className="tactile-press inline-flex items-center gap-0.5 font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2"
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
    <div className="w-full space-y-6">
      {/* Top Page Header Card */}
      <div className="surface-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
                Log Vital Signs
              </h1>
              <StatusBadge status={API_STATUS[evaluation.status]} />
              {prefilledFromLog && (
                <span className="inline-flex items-center rounded-pill border border-line bg-surface-subtle/70 px-2.5 py-0.5 font-mono text-[11px] text-stem">
                  Pre-filled from latest log
                </span>
              )}
            </div>
            <p className="text-sm text-stem max-w-2xl">
              Start with an optical scan to auto-fill pulse and sleep telemetry, review or modify any
              value manually below, and complete the behavioral check-in.
            </p>
          </div>

          {(crew.canChoose || !crew.selected) && (
            <div className="w-full lg:w-72 shrink-0">
              <label htmlFor="select-astronaut" className="block text-xs font-semibold text-blueberry">
                Monitored Crew Member *
              </label>
              {crew.canChoose ? (
                <select
                  id="select-astronaut"
                  value={crew.selectedId ?? ''}
                  onChange={(e) => crew.setSelectedId(e.target.value)}
                  className="mt-1.5 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry focus:border-sky-400 focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
                >
                  {crew.options.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.role}
                    </option>
                  ))}
                </select>
              ) : (
                <p id="select-astronaut" className="mt-1.5 border-b border-line py-2 text-sm text-blueberry">
                  {crew.isLoading
                    ? 'Loading crew profile…'
                    : 'Your account is not linked to a crew member yet. Ask the Flight Surgeon to add you to a crew.'}
                </p>
              )}
              {crew.error && <p className="mt-1.5 text-xs text-status-critical">{crew.error}</p>}
            </div>
          )}
        </div>

        {/* 2-Step Underline Navigation */}
        <div className="mt-6 flex flex-wrap gap-6 border-b border-line text-xs font-semibold">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(i)}
              className={`tactile-press -mb-px border-b-2 pb-3 text-left transition-colors ${
                step === i
                  ? 'border-sky-400 text-blueberry'
                  : step > i
                    ? 'border-transparent text-status-nominal hover:text-blueberry'
                    : 'border-transparent text-stem hover:text-blueberry'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 border-l-2 border-status-critical pl-4 py-1 flex items-start gap-2.5 text-xs text-status-critical"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 0 ? (
          <div className="space-y-6 animate-materialize">
            {/* Optical Scan Section (Full Width) */}
            {scannerOpen ? (
              <div className="surface-card p-5 sm:p-6">
                <VisionBiometricsPanel
                  embedded
                  onApplyVitals={handleApplyOptical}
                  onSkipToManual={handleSkipToManual}
                />
              </div>
            ) : (
              <div className="surface-card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stem">
                  <strong className="font-semibold text-blueberry">Manual entry mode active</strong>
                  {' · '}Optical Scan camera paused. Enter or adjust all parameters below.
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface-tinted px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-hover"
                >
                  <Camera className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>Open Optical Scan</span>
                </button>
              </div>
            )}

            {/* Editable Vital Signs Card */}
            <div ref={vitalsSectionRef} className="surface-card p-6 sm:p-8 space-y-6">
              <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
                <Activity className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs text-blueberry/90 leading-relaxed">
                  <strong className="text-blueberry block font-semibold mb-0.5">
                    Vital Signs &amp; Cabin Measurements (All Fields Editable)
                  </strong>
                  Verify or manually enter your physiological readings. Heart rate and sleep duration
                  auto-update from the optical scan until edited manually.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

            {/* Behavioral Check-In & EVA Notes Split */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 surface-card p-6 sm:p-8">
                <MoodCheckIn value={vitals.mood} onChange={setVital('mood')} />
              </div>

              <div className="lg:col-span-5 surface-card p-6 sm:p-8 flex flex-col justify-between gap-5">
                <div>
                  <label htmlFor="notes" className="block text-xs font-semibold text-blueberry">
                    EVA Observations or Symptoms (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Mild headache post-EVA, 0.166g acclimation nominal..."
                    className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry placeholder-stem/60 focus:border-sky-400 focus:outline-none resize-none transition-colors"
                  />
                </div>

                <div className="border-t border-line pt-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-stem">
                      Onboard Pre-Check
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-blueberry tabular-nums">
                      {nominalCount} of {EVALUATED_FIELDS.length} parameters within nominal limits
                    </span>
                  </div>
                  <StatusBadge status={API_STATUS[evaluation.status]} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface-card p-6 sm:p-8 space-y-6 animate-materialize">
            <AssessmentPanel
              evaluation={evaluation}
              vitals={vitals}
              astronautId={crew.selectedId}
              astronautName={crew.selected?.name}
              verificationPhase={verificationPhase}
              onApplyRecheck={handleApplyRecheck}
              onEmergencyBypass={() => setVerificationPhase('emergency_bypass')}
              onCheckedStepsChange={handleCheckedStepsChange}
            />
            <p className="flex items-start gap-2 border-t border-line pt-4 text-[11px] text-stem">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              Preview computed onboard with the same clinical thresholds the server applies when saving.
            </p>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="surface-card px-6 py-4 flex items-center justify-between gap-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(0)}
              className="tactile-press flex items-center gap-1.5 py-2 text-xs font-semibold text-stem hover:text-blueberry"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Scan &amp; Vitals</span>
            </button>
          ) : (
            <span className="text-xs text-stem tabular-nums">
              {crew.selected ? `Target: ${crew.selected.name}` : 'Select crew member to log telemetry'}
            </span>
          )}

          {step < LAST_STEP ? (
            <button
              key="next"
              type="button"
              onClick={() => goTo(step + 1)}
              className="tactile-press flex items-center gap-2 rounded-sm bg-plate px-6 py-2.5 text-xs font-semibold text-ink-inverse hover:bg-plate/90"
            >
              <span>Review Assessment</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={isSubmitting || !crew.selectedId || criticalLocked}
              className={`tactile-press flex items-center gap-2 rounded-sm px-7 py-3 text-xs font-semibold transition-[background-color,opacity] duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
                evaluation.status === 'CRITICAL' && !criticalLocked
                  ? 'bg-[var(--status-critical)] text-white hover:opacity-90'
                  : 'bg-plate text-ink-inverse hover:bg-plate/90'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-inverse border-t-transparent" />
                  <span>Transmitting telemetry...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {criticalLocked
                      ? 'Complete Stabilization & Verify Above'
                      : evaluation.status === 'CRITICAL'
                        ? 'Save & Escalate Critical Reading'
                        : verificationPhase === 'stabilized'
                          ? 'Confirm & Save Verified Reading'
                          : 'Confirm & Save Reading'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
