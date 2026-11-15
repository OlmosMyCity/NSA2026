'use client';

import { CheckCircle2, Cpu, PhoneCall } from 'lucide-react';
import type { DecisionResult, RecommendedAction } from '../../services/digitalTwinService';

const ACTION_LABELS: Record<RecommendedAction, string> = {
  re_measure: 'Re-measure in 5–30 min',
  rest: 'Prioritize rest & circadian hygiene',
  exercise: 'Execute ARED / T2 exercise protocol',
  shelter_shielding: 'Move to Storm Shelter / increase shielding',
  contact_ground: 'Contact Flight Surgeon immediately',
  no_action: 'Nominal — continue mission routine',
};

interface TriageDecisionCardProps {
  decision: DecisionResult | null;
  isLoading: boolean;
}

/** Displays rule-authoritative triage action, flight-surgeon escalation state, and AI discrepancy alerts. */
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

  const { escalar, accion, confianza, freeTextMoodEstimate } = decision;
  const confidencePct = Math.round(confianza * 100);

  return (
    <section
      aria-label="My Health Clinical Triage"
      className="surface-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-berry" aria-hidden="true" />
          <h2 className="text-sm font-bold text-blueberry">
            Clinical Triage &amp; Guidance
          </h2>
          <span className="rounded-pill bg-surface-tinted px-2.5 py-0.5 text-[11px] font-medium text-stem">
            {confidencePct}% confidence
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-tinted p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stem">
            Recommended Action
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
          </p>
        </div>
      </div>

      {freeTextMoodEstimate && (
        <p className="text-xs text-stem">
          Mood note assessment: <strong className="text-blueberry">{freeTextMoodEstimate.moodScore}/5</strong>{' '}
          ({Math.round(freeTextMoodEstimate.confidence * 100)}% confidence)
        </p>
      )}
    </section>
  );
}
