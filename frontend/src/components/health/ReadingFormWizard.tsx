'use client';

/**
 * @module components/health/ReadingFormWizard
 * Four-step vital-signs intake wizard (Cardiovascular, Metabolic, Life Support,
 * and Assessment) featuring real-time optimistic evaluation against NASA HRP
 * thresholds via `healthService.evaluate` prior to telemetry submission.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { healthService } from '../../services/healthService';
import { astronautService } from '@/services/astronautService';
import { Astronaut } from '@/domain/astronauts/types';
import { ApiHealthStatus, EvaluationResult } from '../../domain/health/types';
import { useAuth } from '@/context/AuthContext';
import {
  Activity,
  Thermometer,
  Moon,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react';

interface ReadingFormWizardProps {
  initialAstronautId?: string;
}

const STEPS = [
  { id: 1, label: '1. Cardiovascular' },
  { id: 2, label: '2. Metabolic' },
  { id: 3, label: '3. Life Support' },
  { id: 4, label: '4. Assessment' },
];

/** Multi-step crew telemetry intake wizard with live deterministic clinical preview. */
export function ReadingFormWizard({ initialAstronautId }: ReadingFormWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>(initialAstronautId || '');

  const [heartRateBpm, setHeartRateBpm] = useState<number>(72);
  const [systolicMmHg, setSystolicMmHg] = useState<number>(120);
  const [diastolicMmHg, setDiastolicMmHg] = useState<number>(80);
  const [glucoseMgDl, setGlucoseMgDl] = useState<number>(95);
  const [temperatureC, setTemperatureC] = useState<number>(36.6);
  const [spo2Pct, setSpo2Pct] = useState<number>(98);
  const [sleepHours, setSleepHours] = useState<number>(7.5);
  const [moodEnergy, setMoodEnergy] = useState<number>(4);
  const [moodFocus, setMoodFocus] = useState<number>(4);
  const [moodCalm, setMoodCalm] = useState<number>(4);
  const mood = Math.round((moodEnergy + moodFocus + moodCalm) / 3);
  const [notes, setNotes] = useState<string>('');

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const result = healthService.evaluate({
      heartRateBpm: Number(heartRateBpm),
      systolicMmHg: Number(systolicMmHg),
      diastolicMmHg: Number(diastolicMmHg),
      glucoseMgDl: Number(glucoseMgDl),
      temperatureC: Number(temperatureC),
      spo2Pct: Number(spo2Pct),
      sleepHours: Number(sleepHours),
      mood: Number(mood),
    });
    setEvaluation(result);
  }, [heartRateBpm, systolicMmHg, diastolicMmHg, glucoseMgDl, temperatureC, spo2Pct, sleepHours, mood]);

  const handleNext = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedAstronautId) {
      setErrorMessage('Please select the astronaut for this reading.');
      return;
    }

    try {
      setIsSubmitting(true);
      await healthService.createReading({
        astronautId: selectedAstronautId,
        heartRateBpm: Number(heartRateBpm),
        systolicMmHg: Number(systolicMmHg),
        diastolicMmHg: Number(diastolicMmHg),
        glucoseMgDl: Number(glucoseMgDl),
        temperatureC: Number(temperatureC),
        spo2Pct: Number(spo2Pct),
        sleepHours: Number(sleepHours),
        mood: Number(mood),
        notes: notes.trim() || null,
      });

      router.push('/routine?recorded=true');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to log telemetry to the system.';
      setErrorMessage(msg);
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
            <span>Critical Status</span>
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
            <span>Nominal Condition</span>
          </span>
        );
    }
  };

  return (
    <div className="surface-card mx-auto max-w-3xl p-6 sm:p-10">
      <div className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            Log Vital Signs
          </h1>
          {evaluation && getStatusBadge(evaluation.status)}
        </div>
        <p className="mt-1.5 text-sm text-stem">
          Record vitals for onboard clinical triage.
        </p>

        {/* Wizard steps — text tabs with bottom underline */}
        <div className="mt-8 flex flex-wrap gap-6 border-b border-line text-xs font-semibold">
          {STEPS.map((s) => {
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id)}
                className={`-mb-px border-b-2 pb-3 text-left transition-colors ${
                  isActive
                    ? 'border-plate text-blueberry'
                    : isCompleted
                    ? 'border-transparent text-status-nominal hover:text-blueberry'
                    : 'border-transparent text-stem hover:text-blueberry'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Astronaut selector — label + underline select, no wrapper box */}
      <div className="mt-8">
        <label
          htmlFor="select-astronaut"
          className="block text-xs font-semibold text-blueberry"
        >
          Monitored Crew Member *
        </label>
        <select
          id="select-astronaut"
          value={selectedAstronautId}
          disabled={user?.role !== 'ADMIN' && astronauts.length <= 1}
          onChange={(e) => setSelectedAstronautId(e.target.value)}
          className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm text-blueberry focus:border-blueberry focus:outline-none disabled:opacity-75 [&>option]:bg-canvas [&>option]:text-blueberry"
        >
          {astronauts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.role}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-8 border-l-2 border-status-critical pl-4 py-1 flex items-start gap-2.5 text-xs text-status-critical"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {currentStep === 1 && (
          <div className="space-y-8 animate-materialize">
            <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
              <Info className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blueberry/90 leading-relaxed">
                <strong className="text-blueberry block font-semibold mb-0.5">
                  Cardiovascular Protocol (Fluid Shift Risk)
                </strong>
                Remain seated at rest for 5 minutes prior to measurement. Position the cuff on the
                left arm at heart level.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label htmlFor="heartRate" className="block text-xs font-semibold text-blueberry">
                  Heart Rate (bpm) *
                </label>
                <input
                  id="heartRate"
                  type="number"
                  min="30"
                  max="220"
                  required
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: 50 – 90 bpm
                </span>
              </div>

              <div>
                <label htmlFor="systolic" className="block text-xs font-semibold text-blueberry">
                  Systolic BP (mmHg) *
                </label>
                <input
                  id="systolic"
                  type="number"
                  min="60"
                  max="240"
                  required
                  value={systolicMmHg}
                  onChange={(e) => setSystolicMmHg(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: &lt; 130 mmHg
                </span>
              </div>

              <div>
                <label htmlFor="diastolic" className="block text-xs font-semibold text-blueberry">
                  Diastolic BP (mmHg) *
                </label>
                <input
                  id="diastolic"
                  type="number"
                  min="40"
                  max="140"
                  required
                  value={diastolicMmHg}
                  onChange={(e) => setDiastolicMmHg(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: &lt; 85 mmHg
                </span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-8 animate-materialize">
            <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
              <Thermometer className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blueberry/90 leading-relaxed">
                <strong className="text-blueberry block font-semibold mb-0.5">
                  Metabolic &amp; Thermal Protocol (Radiation &amp; Immunity)
                </strong>
                Sanitize the fingertip before lancing. Body temperature is recorded via the helmet
                tympanic sensor or cabin infrared thermometer.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="glucose" className="block text-xs font-semibold text-blueberry">
                  Blood Glucose (mg/dL) *
                </label>
                <input
                  id="glucose"
                  type="number"
                  step="0.1"
                  min="40"
                  max="350"
                  required
                  value={glucoseMgDl}
                  onChange={(e) => setGlucoseMgDl(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: 70 – 140 mg/dL
                </span>
              </div>

              <div>
                <label htmlFor="temperature" className="block text-xs font-semibold text-blueberry">
                  Body Temperature (°C) *
                </label>
                <input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="34.0"
                  max="43.0"
                  required
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: 36.1 – 37.5 °C
                </span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8 animate-materialize">
            <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
              <Moon className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blueberry/90 leading-relaxed">
                <strong className="text-blueberry block font-semibold mb-0.5">
                  Habitat &amp; Behavioral Protocol (Isolation &amp; Confinement)
                </strong>
                Place the pulse oximeter on your index finger. Enter actual hours slept in the past
                24-hour cycle and rate your mood.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label htmlFor="spo2" className="block text-xs font-semibold text-blueberry">
                  SpO₂ Saturation (%) *
                </label>
                <input
                  id="spo2"
                  type="number"
                  step="0.1"
                  min="80"
                  max="100"
                  required
                  value={spo2Pct}
                  onChange={(e) => setSpo2Pct(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: ≥ 95 %
                </span>
              </div>

              <div>
                <label htmlFor="sleepHours" className="block text-xs font-semibold text-blueberry">
                  Sleep Duration (h/day) *
                </label>
                <input
                  id="sleepHours"
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  required
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="mt-2 w-full border-0 border-b border-line bg-transparent py-2 px-0 text-sm font-mono font-semibold text-blueberry tabular-nums focus:border-blueberry focus:outline-none"
                />
                <span className="text-[11px] text-stem mt-1.5 block tabular-nums">
                  Nominal: ≥ 7.0 h
                </span>
              </div>

              <div className="sm:col-span-2 space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="block text-xs font-semibold text-blueberry">
                    Mood &amp; Behavioral Check-In (classified 1 – 5) *
                  </span>
                  <span className="text-xs font-mono font-semibold text-blueberry">
                    Score: {mood}/5 ·{' '}
                    {mood === 5
                      ? 'Excellent'
                      : mood === 4
                        ? 'Good'
                        : mood === 3
                          ? 'Fair'
                          : mood === 2
                            ? 'Low'
                            : 'Critical'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block text-[11px] text-stem">
                    <span className="block font-semibold text-blueberry mb-1">
                      1. Energy &amp; Rest
                    </span>
                    <select
                      value={moodEnergy}
                      onChange={(e) => setMoodEnergy(Number(e.target.value))}
                      className="w-full border-0 border-b border-line bg-transparent py-1.5 px-0 text-xs text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
                    >
                      <option value={5}>5 - Fully energized</option>
                      <option value={4}>4 - Rested</option>
                      <option value={3}>3 - Moderate fatigue</option>
                      <option value={2}>2 - Tired</option>
                      <option value={1}>1 - Exhausted</option>
                    </select>
                  </label>

                  <label className="block text-[11px] text-stem">
                    <span className="block font-semibold text-blueberry mb-1">
                      2. Cognitive Focus
                    </span>
                    <select
                      value={moodFocus}
                      onChange={(e) => setMoodFocus(Number(e.target.value))}
                      className="w-full border-0 border-b border-line bg-transparent py-1.5 px-0 text-xs text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
                    >
                      <option value={5}>5 - Sharp &amp; clear</option>
                      <option value={4}>4 - Nominal focus</option>
                      <option value={3}>3 - Slightly distracted</option>
                      <option value={2}>2 - Brain fog</option>
                      <option value={1}>1 - Disoriented</option>
                    </select>
                  </label>

                  <label className="block text-[11px] text-stem">
                    <span className="block font-semibold text-blueberry mb-1">
                      3. Stress &amp; Isolation
                    </span>
                    <select
                      value={moodCalm}
                      onChange={(e) => setMoodCalm(Number(e.target.value))}
                      className="w-full border-0 border-b border-line bg-transparent py-1.5 px-0 text-xs text-blueberry focus:border-blueberry focus:outline-none [&>option]:bg-canvas [&>option]:text-blueberry"
                    >
                      <option value={5}>5 - Calm &amp; motivated</option>
                      <option value={4}>4 - Steady</option>
                      <option value={3}>3 - Mild tension</option>
                      <option value={2}>2 - Anxious / isolated</option>
                      <option value={1}>1 - Overwhelmed</option>
                    </select>
                  </label>
                </div>
                <span className="text-[11px] text-stem block">
                  Nominal: composite score 4 or 5 (NASA HRP behavioral health check-in)
                </span>
              </div>
            </div>

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
        )}

        {currentStep === 4 && evaluation && (
          <div className="space-y-8 animate-materialize">
            <div
              className={`border-l-2 pl-4 space-y-4 ${
                evaluation.status === 'CRITICAL'
                  ? 'border-status-critical'
                  : evaluation.status === 'WARNING'
                  ? 'border-status-caution'
                  : 'border-status-nominal'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blueberry" />
                  <span className="text-sm font-bold text-blueberry">
                    Autonomous Onboard Assessment
                  </span>
                </div>
                {getStatusBadge(evaluation.status)}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-blueberry block">
                  Identified physiological alerts:
                </span>
                {evaluation.alerts.length === 0 ? (
                  <p className="text-sm text-status-nominal flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    All 7 vitals nominal.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {evaluation.alerts.map((alert, i) => (
                      <li
                        key={i}
                        className="text-xs text-blueberry flex items-start gap-2"
                      >
                        <AlertTriangle className="h-4 w-4 text-status-critical flex-shrink-0 mt-0.5" />
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold text-berry block mb-1">
                  Flight Medical Recommendation
                </span>
                <p className="text-sm text-blueberry leading-relaxed">
                  {evaluation.recommendation}
                </p>
              </div>
            </div>

            {/* Summary grid — flat typographic values, no inner boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 text-xs pt-2">
              <div>
                <span className="text-stem block text-[11px]">Heart Rate</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {heartRateBpm} bpm
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Blood Pressure</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {systolicMmHg}/{diastolicMmHg}
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Glucose</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {glucoseMgDl} mg/dL
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Temperature</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {temperatureC} °C
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">O₂ Saturation</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {spo2Pct} %
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Sleep</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  {sleepHours} h
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Mood</span>
                <strong className="text-blueberry font-mono text-sm tabular-nums mt-0.5 block">
                  Level {mood}/5
                </strong>
              </div>
              <div>
                <span className="text-stem block text-[11px]">Astronaut</span>
                <strong className="text-berry text-xs truncate block mt-1">
                  {astronauts.find((a) => a.id === selectedAstronautId)?.name || 'Selected'}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Wizard navigation — Next step is the only solid button */}
        <div className="flex items-center justify-between pt-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="tactile-press flex items-center gap-1.5 py-2 text-xs font-semibold text-stem hover:text-blueberry"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-6 py-2.5 text-xs font-semibold text-plate hover:bg-berry"
            >
              <span>Next step</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
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
