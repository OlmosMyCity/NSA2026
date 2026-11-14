'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { healthService } from '../services/healthService';
import { evaluateVitals } from '../domain/evaluate';
import { API_STATUS } from '../domain/api-adapter';
import type { Vitals } from '../domain/types';
import { StatusBadge } from './StatusBadge';
import { AssessmentPanel } from './reading-form/AssessmentPanel';
import { VitalField } from './reading-form/VitalField';
import { ASSESSMENT_STEP_LABEL, DEFAULT_VITALS, VITAL_STEPS } from './reading-form/steps';
import { useCrewSelection } from './reading-form/useCrewSelection';

const STEP_LABELS = [...VITAL_STEPS.map((s) => s.label), ASSESSMENT_STEP_LABEL];
const LAST_STEP = STEP_LABELS.length - 1;

export function ReadingFormWizard({ initialAstronautId }: { initialAstronautId?: string }) {
  const router = useRouter();
  const crew = useCrewSelection(initialAstronautId);

  const [step, setStep] = useState(0);
  const [vitals, setVitals] = useState<Vitals>(DEFAULT_VITALS);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evaluation = useMemo(() => evaluateVitals(vitals), [vitals]);
  const setVital = (field: keyof Vitals) => (value: number) => setVitals((v) => ({ ...v, [field]: value }));

  const goTo = (next: number) => {
    setErrorMessage(null);
    setStep(Math.min(LAST_STEP, Math.max(0, next)));
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
      await healthService.createReading({ astronautId: crew.selectedId, ...vitals, notes: notes.trim() || null });
      router.push('/routine?recorded=true');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to log telemetry to the system.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const current = VITAL_STEPS[step];

  return (
    <div className="surface-card mx-auto max-w-3xl p-6 sm:p-10">
      <div className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">Log Vital Signs</h1>
          <StatusBadge status={API_STATUS[evaluation.status]} />
        </div>
        <p className="mt-1.5 text-sm text-stem">
          Record vitals for onboard clinical triage.
        </p>

        <div className="mt-8 flex flex-wrap gap-6 border-b border-line text-xs font-semibold">
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

      <div className="mt-8">
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
              : crew.selected
                ? `${crew.selected.name} — ${crew.selected.role}`
                : 'Your account is not linked to a crew member yet. Ask the Flight Surgeon to add you to a crew.'}
          </p>
        )}
        {crew.error && <p className="mt-2 text-xs text-status-critical">{crew.error}</p>}
      </div>

      {errorMessage && (
        <div role="alert" className="mt-8 border-l-2 border-status-critical pl-4 py-1 flex items-start gap-2.5 text-xs text-status-critical">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {current ? (
          <div className="space-y-8 animate-materialize">
            <div className="border-l-2 border-berry/70 pl-4 py-0.5 flex items-start gap-3">
              <current.icon className="h-4 w-4 text-berry flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blueberry/90 leading-relaxed">
                <strong className="text-blueberry block font-semibold mb-0.5">{current.protocolTitle}</strong>
                {current.protocol}
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${current.fields.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {current.fields.map(({ indicator, field }) => (
                <VitalField key={field} indicator={indicator} value={vitals[field]} onChange={setVital(field)} />
              ))}
            </div>

            {step === VITAL_STEPS.length - 1 && (
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
            )}
          </div>
        ) : (
          <AssessmentPanel evaluation={evaluation} vitals={vitals} astronautName={crew.selected?.name} />
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
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {/* Keys distintas: si React reutilizara el botón, el clic en "Next step" que lleva
              al último paso cambiaría su type a submit y enviaría el formulario. */}
          {step < LAST_STEP ? (
            <button
              key="next"
              type="button"
              onClick={() => goTo(step + 1)}
              className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-6 py-2.5 text-xs font-semibold text-plate hover:bg-berry"
            >
              <span>Next step</span>
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
