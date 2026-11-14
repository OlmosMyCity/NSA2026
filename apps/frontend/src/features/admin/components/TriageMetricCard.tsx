import { AlertTriangle, CheckCircle2, Radio, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { CrewMemberTriage, FlightSurgeonMetrics } from '../domain/types';

export type TriageFilter = 'ALL' | CrewMemberTriage['status'];

interface MetricDef {
  label: string;
  hint: string;
  icon: LucideIcon;
  count: (m: FlightSurgeonMetrics) => number;
  text: string;
  active: string;
  idle: string;
}

const METRICS: Record<TriageFilter, MetricDef> = {
  ALL: {
    label: 'Active Crew',
    hint: 'Artemis IV & Gateway Station',
    icon: Radio,
    count: (m) => m.totalCrew,
    text: 'text-blueberry',
    active: 'border-blueberry bg-surface shadow-sm ring-1 ring-blueberry',
    idle: 'border-line bg-surface hover:border-line-strong',
  },
  CRITICAL: {
    label: 'Critical Priority',
    hint: 'Requires immediate medical intervention',
    icon: AlertTriangle,
    count: (m) => m.criticalCount,
    text: 'text-status-critical',
    active: 'border-status-critical bg-[var(--status-critical-bg)] ring-1 ring-status-critical',
    idle: 'border-[var(--status-critical-border)] bg-surface hover:bg-[var(--status-critical-bg)]',
  },
  WARNING: {
    label: 'Observation / Watch',
    hint: 'Parameters near HRP tolerance limits',
    icon: ShieldAlert,
    count: (m) => m.warningCount,
    text: 'text-status-caution',
    active: 'border-status-caution bg-[var(--status-caution-bg)] ring-1 ring-status-caution',
    idle: 'border-[var(--status-caution-border)] bg-surface hover:bg-[var(--status-caution-bg)]',
  },
  OK: {
    label: 'Nominal Condition',
    hint: 'Biometrics within nominal range',
    icon: CheckCircle2,
    count: (m) => m.nominalCount,
    text: 'text-status-nominal',
    active: 'border-status-nominal bg-[var(--status-nominal-bg)] ring-1 ring-status-nominal',
    idle: 'border-[var(--status-nominal-border)] bg-surface hover:bg-[var(--status-nominal-bg)]',
  },
};

export const TRIAGE_FILTERS = Object.keys(METRICS) as TriageFilter[];

interface TriageMetricCardProps {
  filter: TriageFilter;
  metrics: FlightSurgeonMetrics;
  selected: boolean;
  onSelect: (filter: TriageFilter) => void;
}

export function TriageMetricCard({ filter, metrics, selected, onSelect }: TriageMetricCardProps) {
  const def = METRICS[filter];
  const Icon = def.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(filter)}
      className={`tactile-press text-left rounded-lg border p-5 transition-all ${selected ? def.active : def.idle}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${filter === 'ALL' ? 'text-berry' : def.text}`}>{def.label}</span>
        <Icon className={`h-4 w-4 ${filter === 'ALL' ? 'text-berry' : def.text}`} aria-hidden="true" />
      </div>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${def.text}`}>{def.count(metrics)}</p>
      <span className="mt-1 block text-xs text-stem">{def.hint}</span>
    </button>
  );
}
