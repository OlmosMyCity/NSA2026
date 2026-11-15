'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { healthService } from '../services/healthService';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { Astronaut } from '@/features/astronauts/domain/types';
import { ApiHealthStatus, EvaluationResult } from '../domain/types';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ReadingFormWizardProps {
  initialAstronautId?: string;
}

type FieldKey =
  | 'astronaut'
  | 'heartRateBpm'
  | 'systolicMmHg'
  | 'diastolicMmHg'
  | 'glucoseMgDl'
  | 'temperatureC'
  | 'spo2Pct'
  | 'sleepHours';

interface FieldSpec {
  key: Exclude<FieldKey, 'astronaut'>;
  label: string;
  placeholder: string;
  min: number;
  max: number;
  step?: string;
  unit: string;
}

const VITAL_FIELDS: FieldSpec[] = [
  { key: 'heartRateBpm', label: 'Heart Rate (bpm)', placeholder: 'e.g. 72', min: 30, max: 220, unit: 'bpm' },
  { key: 'systolicMmHg', label: 'Systolic BP (mmHg)', placeholder: 'e.g. 120', min: 60, max: 240, unit: 'mmHg' },
  { key: 'diastolicMmHg', label: 'Diastolic BP (mmHg)', placeholder: 'e.g. 80', min: 40, max: 140, unit: 'mmHg' },
  { key: 'glucoseMgDl', label: 'Blood Glucose (mg/dL)', placeholder: 'e.g. 95', min: 40, max: 350, step: '0.1', unit: 'mg/dL' },
  { key: 'temperatureC', label: 'Temperature (°C)', placeholder: 'e.g. 36.6', min: 34, max: 43, step: '0.1', unit: '°C' },
  { key: 'spo2Pct', label: 'SpO₂ (%)', placeholder: 'e.g. 98', min: 80, max: 100, step: '0.1', unit: '%' },
  { key: 'sleepHours', label: 'Sleep (h)', placeholder: 'e.g. 7.5', min: 0, max: 24, step: '0.1', unit: 'h' },
];

export function ReadingFormWizard({ initialAstronautId }: ReadingFormWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>(initialAstronautId || '');

  const [values, setValues] = useState<Record<Exclude<FieldKey, 'astronaut'>, string>>({
    heartRateBpm: '72',
    systolicMmHg: '120',
    diastolicMmHg: '80',
    glucoseMgDl: '95',
    temperatureC: '36.6',
    spo2Pct: '98',
    sleepHours: '7.5',
  });
  const [mood, setMood] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const loadCrew = async () => {
      try {
        const res = await astronautService.list({ limit: 50 });
        const isAdmin = user?.role === 'ADMIN';
        const myAstro = res.data.find((a) => a.userId === user?.id || a.id === user?.astronautId);
        const visibleCrew = isAdmin || !myAstro ? res.data : [myAstro];

        setAstronauts(visibleCrew);
        if (!isAdmin && myAstro) {
          setSelectedAstronautId(myAstro.id);
        } else if (!selectedAstronautId && visibleCrew.length > 0) {
          setSelectedAstronautId(myAstro ? myAstro.id : visibleCrew[0].id);
        }
      } catch {
        // Fallback
      }
    };
    loadCrew();
  }, [user, selectedAstronautId]);

  useEffect(() => {
    const nums = {
      heartRateBpm: Number(values.heartRateBpm),
      systolicMmHg: Number(values.systolicMmHg),
      diastolicMmHg: Number(values.diastolicMmHg),
      glucoseMgDl: Number(values.glucoseMgDl),
      temperatureC: Number(values.temperatureC),
      spo2Pct: Number(values.spo2Pct),
      sleepHours: Number(values.sleepHours),
    };
    const allValid = VITAL_FIELDS.every((f) => {
      const raw = values[f.key].trim();
      const n = nums[f.key];
      return raw !== '' && Number.isFinite(n) && n >= f.min && n <= f.max;
    });
    if (!allValid) {
      setEvaluation(null);
      return;
    }

    setEvaluation(
      healthService.evaluate({
        ...nums,
        mood: Number(mood),
      })
    );
  }, [values, mood]);

  const updateField = (key: Exclude<FieldKey, 'astronaut'>, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    setFieldErrors((prev) => {
      if (!prev[key] && !(key === 'systolicMmHg' && prev.diastolicMmHg)) return prev;
      const copy = { ...prev };
      delete copy[key];
      if (key === 'systolicMmHg') delete copy.diastolicMmHg;
      return copy;
    });
  };

  const validate = (): boolean => {
    const errors: Partial<Record<FieldKey, string>> = {};

    if (!selectedAstronautId) {
      errors.astronaut = 'Select a crew member from the list.';
    }

    for (const f of VITAL_FIELDS) {
      const raw = values[f.key].trim();
      const num = Number(raw);
      if (raw === '' || !Number.isFinite(num) || num < f.min || num > f.max) {
        errors[f.key] = `Enter a value between ${f.min} and ${f.max} ${f.unit}.`;
      }
    }

    const sys = Number(values.systolicMmHg);
    const dia = Number(values.diastolicMmHg);
    if (!errors.systolicMmHg && !errors.diastolicMmHg && dia >= sys) {
      errors.diastolicMmHg = `Enter a value lower than systolic BP (${sys} mmHg).`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await healthService.createReading({
        astronautId: selectedAstronautId,
        heartRateBpm: Number(values.heartRateBpm),
        systolicMmHg: Number(values.systolicMmHg),
        diastolicMmHg: Number(values.diastolicMmHg),
        glucoseMgDl: Number(values.glucoseMgDl),
        temperatureC: Number(values.temperatureC),
        spo2Pct: Number(values.spo2Pct),
        sleepHours: Number(values.sleepHours),
        mood: Number(mood),
        notes: notes.trim() || null,
      });

      router.push('/routine?recorded=true');
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? `${err.message} Check your inputs and try again.`
          : 'Could not save reading. Check your connection and try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ApiHealthStatus) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-status-critical">
            <span className="h-2 w-2 rounded-full bg-status-critical" aria-hidden="true" />
            <span>Critical</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-status-caution">
            <span className="h-2 w-2 rounded-full bg-status-caution" aria-hidden="true" />
            <span>Preventive Watch</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-status-nominal">
            <span className="h-2 w-2 rounded-full bg-status-nominal" aria-hidden="true" />
            <span>Nominal</span>
          </span>
        );
    }
  };

  return (
    <div className="surface-card mx-auto max-w-3xl p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
          Log Vital Signs
        </h1>
        {evaluation && getStatusBadge(evaluation.status)}
      </div>

      {submitError && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-status-critical pl-4 py-1 flex items-start gap-2.5 text-xs text-status-critical"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        <div>
          <label htmlFor="select-astronaut" className="block text-xs font-semibold text-blueberry">
            Crew Member *
          </label>
          <select
            id="select-astronaut"
            value={selectedAstronautId}
            disabled={user?.role !== 'ADMIN' && astronauts.length <= 1}
            onChange={(e) => {
              setSelectedAstronautId(e.target.value);
              setFieldErrors((prev) => {
                if (!prev.astronaut) return prev;
                const copy = { ...prev };
                delete copy.astronaut;
                return copy;
              });
            }}
            className="mt-1.5 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry focus:border-blueberry focus:outline-none disabled:opacity-75 [&>option]:bg-canvas [&>option]:text-blueberry"
          >
            {astronauts.length === 0 && <option value="">Select a crew member...</option>}
            {astronauts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.role}
              </option>
            ))}
          </select>
          {fieldErrors.astronaut && (
            <p role="alert" className="mt-1 text-xs text-status-critical">
              {fieldErrors.astronaut}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
          {VITAL_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-xs font-semibold text-blueberry">
                {field.label} *
              </label>
              <input
                id={field.key}
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                aria-invalid={Boolean(fieldErrors[field.key])}
                className="mt-1.5 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry placeholder-stem/50 tabular-nums focus:border-blueberry focus:outline-none"
              />
              {fieldErrors[field.key] && (
                <p role="alert" className="mt-1 text-[11px] text-status-critical leading-snug">
                  {fieldErrors[field.key]}
                </p>
              )}
            </div>
          ))}

          <div>
            <label htmlFor="mood" className="block text-xs font-semibold text-blueberry">
              Mood (1–5) *
            </label>
            <select
              id="mood"
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="mt-1.5 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-xs text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
            >
              <option value={5}>5 — Excellent</option>
              <option value={4}>4 — Good</option>
              <option value={3}>3 — Fair</option>
              <option value={2}>2 — Low</option>
              <option value={1}>1 — Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-xs font-semibold text-blueberry">
            Notes (optional)
          </label>
          <input
            id="notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Mild headache post-EVA, hydrated with 500 mL"
            className="mt-1.5 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry placeholder-stem/50 focus:border-blueberry focus:outline-none"
          />
        </div>

        {evaluation && (
          <div
            className={`border-l-2 pl-4 py-1 space-y-1.5 ${
              evaluation.status === 'CRITICAL'
                ? 'border-status-critical'
                : evaluation.status === 'WARNING'
                ? 'border-status-caution'
                : 'border-status-nominal'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blueberry">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Onboard Assessment</span>
              </span>
              {getStatusBadge(evaluation.status)}
            </div>

            {evaluation.alerts.length > 0 && (
              <ul className="space-y-1">
                {evaluation.alerts.map((alert, i) => (
                  <li key={i} className="text-xs text-blueberry flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-status-critical flex-shrink-0 mt-0.5" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-stem leading-relaxed">{evaluation.recommendation}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-6 py-2.5 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-plate border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Save Reading</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
