'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { SkeletonCard } from '@/components/common/Skeleton';
import { adminTriageService } from '../../services/adminTriageService';
import type { CrewMemberTriage, FlightSurgeonMetrics } from '../../domain/admin/types';
import { CrewTriageCard } from './CrewTriageCard';
import { DirectiveDialog } from './DirectiveDialog';
import { RadiationIncidentBanner } from './RadiationIncidentBanner';
import { TRIAGE_FILTERS, TriageMetricCard, type TriageFilter } from './TriageMetricCard';

const EMPTY_METRICS: FlightSurgeonMetrics = { totalCrew: 0, criticalCount: 0, warningCount: 0, nominalCount: 0, noDataCount: 0 };

export function FlightSurgeonConsole() {
  const triage = useAsync(() => adminTriageService.getTriageOverview(), [], 'Unable to load crew triage.');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TriageFilter>('ALL');
  const [directiveFor, setDirectiveFor] = useState<CrewMemberTriage | null>(null);

  const crew = triage.data?.crew ?? [];
  const q = search.toLowerCase();
  const visible = crew.filter(
    (c) =>
      (filter === 'ALL' || c.status === filter) &&
      [c.astronautName, c.missionName, c.role].some((field) => field.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-8">
      {triage.data?.activeRadiationIncident && <RadiationIncidentBanner incident={triage.data.activeRadiationIncident} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TRIAGE_FILTERS.map((f) => (
          <TriageMetricCard
            key={f}
            filter={f}
            metrics={triage.data?.metrics ?? EMPTY_METRICS}
            selected={filter === f}
            onSelect={setFilter}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stem" />
          <input
            type="text"
            placeholder="Filter by astronaut, role, or mission..."
            aria-label="Filter crew members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-input pl-6 text-sm placeholder:text-stem/70"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`tactile-press py-1.5 text-xs font-semibold tabular-nums transition-colors ${
              filter === 'ALL' ? 'border-b-2 border-plate text-blueberry' : 'text-stem hover:text-blueberry'
            }`}
          >
            All ({crew.length})
          </button>
          {(triage.data?.metrics.noDataCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setFilter('NO_DATA')}
              className={`tactile-press py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                filter === 'NO_DATA' ? 'border-b-2 border-plate text-blueberry' : 'text-stem hover:text-blueberry'
              }`}
            >
              No data ({triage.data?.metrics.noDataCount})
            </button>
          )}
          <button
            type="button"
            onClick={triage.refetch}
            className="tactile-press ml-auto sm:ml-2 flex items-center gap-1.5 py-1.5 text-xs font-semibold text-berry hover:text-blueberry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${triage.isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {triage.error ? (
        <div role="alert" className="ui-callout-critical flex items-start gap-2 text-sm text-status-critical">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{triage.error}</span>
        </div>
      ) : triage.isLoading && !triage.data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-tinted p-12 text-center text-sm text-stem">No astronauts match the selected filter.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visible.map((member) => (
            <CrewTriageCard key={member.astronautId} member={member} onIssueDirective={setDirectiveFor} />
          ))}
        </div>
      )}

      {directiveFor && (
        <DirectiveDialog member={directiveFor} onClose={() => setDirectiveFor(null)} onSent={triage.refetch} />
      )}
    </div>
  );
}
