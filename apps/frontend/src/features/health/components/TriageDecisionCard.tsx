'use client';

import { AlertTriangle, CheckCircle2, Cpu, PhoneCall, ShieldAlert } from 'lucide-react';
import type { DecisionResult, RecommendedAction } from '../services/digitalTwinService';

const ACTION_LABELS: Record<RecommendedAction, string> = {
  re_measure: 'Re-measure in 5–30 min',
  rest: 'Prioritize rest & circadian hygiene',
  exercise: 'Execute ARED / T2 exercise protocol',
  shelter_shielding: 'Move to Storm Shelter / increase shielding',
  contact_ground: 'Contact Flight Surgeon immediately',
  no_action: 'Nominal — continue mission routine',
};

const SOURCE_LABELS: Record<DecisionResult['source'], string> = {
  'gemini-decision-1': 'Gemini Decision 1',
  cache: 'Gemini Decision 1 (cached)',
  'rules-fallback': 'Deterministic Rules',
};

interface TriageDecisionCardProps {
  decision: DecisionResult | null;
  isLoading: boolean;
}

export function TriageDecisionCard({ decision, isLoading }: TriageDecisionCardProps) {
  if (isLoading && !decision) {
    return (
      <div className="surface-card p-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-surface-tinted" />
        <div className="mt-3 h-8 w-full rounded bg-surface-tinted" />
      </div>
    );
  }

  if (!decision) return null;

  const { escalar, accion, confianza, modelEstimate, discrepancy, source, disclaimer, freeTextMoodEstimate } =
    decision;
  const confidencePct = Math.round(confianza * 100);
  const modelEscalarPct = Math.round(modelEstimate.escalarProbabilidad * 100);

  return (
    <section
      aria-label="Digital Twin Triage and Decision Support"
      className="surface-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-berry" aria-hidden="true" />
          <h2 className="text-sm font-bold text-blueberry">
            Triage &amp; Second Opinion
          </h2>
          <span className="rounded-pill bg-surface-tinted px-2.5 py-0.5 text-[11px] font-medium text-stem">
            {SOURCE_LABELS[source]} · {confidencePct}% confidence
          </span>
        </div>

        <span className="rounded-pill border border-black/10 px-2.5 py-0.5 text-[11px] font-medium text-stem">
          {disclaimer}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-tinted p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stem">
            Official Rule Action
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-blueberry">
            {escalar ? (
              <PhoneCall className="h-4 w-4 shrink-0 text-telemetry-red" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-telemetry-green" aria-hidden="true" />
            )}
            <span>{ACTION_LABELS[accion]}</span>
          </p>
        </div>

        <div className="rounded-lg bg-surface-tinted p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stem">
            Escalate to Flight Surgeon
          </p>
          <p className="mt-1 text-sm font-semibold text-blueberry">
            {escalar ? 'YES — Immediate escalation' : 'NO — Monitor on board'}
            <span className="ml-2 text-xs font-normal text-stem">
              (Model P={modelEscalarPct}%)
            </span>
          </p>
        </div>
      </div>

      {freeTextMoodEstimate && (
        <p className="text-xs text-stem">
          Mood note estimate: <strong className="text-blueberry">{freeTextMoodEstimate.moodScore}/5</strong>{' '}
          ({Math.round(freeTextMoodEstimate.confidence * 100)}% confidence)
        </p>
      )}

      {discrepancy.hasDiscrepancy && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Model disagrees with deterministic rules — Official rule prevails
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {discrepancy.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

