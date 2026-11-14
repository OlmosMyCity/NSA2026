'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Send,
  Search,
  ExternalLink,
  RefreshCw,
  Radio,
  X,
} from 'lucide-react';
import { adminTriageService } from '../services/adminTriageService';
import { CrewMemberTriage, FlightSurgeonMetrics } from '../domain/types';
import { AstronautFallbackAvatar } from '@/features/astronauts/components/AstronautFallbackAvatar';
import { SkeletonCard } from '@/features/common/components/Skeleton';

export function FlightSurgeonConsole() {
  const [crew, setCrew] = useState<CrewMemberTriage[]>([]);
  const [metrics, setMetrics] = useState<FlightSurgeonMetrics>({
    totalCrew: 0,
    criticalCount: 0,
    warningCount: 0,
    nominalCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'OK'>('ALL');
  const [selectedCrew, setSelectedCrew] = useState<CrewMemberTriage | null>(null);
  const [directiveText, setDirectiveText] = useState<string>('');
  const [isSendingDirective, setIsSendingDirective] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchTriage = async () => {
    try {
      setIsLoading(true);
      const res = await adminTriageService.getTriageOverview();
      setCrew(res.crew);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Error fetching flight surgeon triage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTriage();
  }, []);

  const handleSendDirective = async () => {
    if (!selectedCrew || !directiveText.trim()) return;
    try {
      setIsSendingDirective(true);
      const res = await adminTriageService.sendClinicalDirectives(
        selectedCrew.astronautId,
        directiveText.trim()
      );
      setFeedbackMessage(res.message);
      setDirectiveText('');
      setTimeout(() => setFeedbackMessage(null), 4000);
      await fetchTriage();
    } catch (err) {
      console.error('Error sending directive:', err);
    } finally {
      setIsSendingDirective(false);
    }
  };

  const filteredCrew = crew.filter((c) => {
    const matchesSearch =
      c.astronautName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.missionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Clinical metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`tactile-press text-left rounded-lg border p-5 transition-all ${
            filterStatus === 'ALL'
              ? 'border-blueberry bg-surface shadow-sm ring-1 ring-blueberry'
              : 'border-line bg-surface hover:border-line-strong'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-berry">
              Active Crew
            </span>
            <Radio className="h-4 w-4 text-berry" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-blueberry">
            {metrics.totalCrew}
          </p>
          <span className="mt-1 block text-xs text-stem">
            Artemis IV &amp; Gateway Station
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('CRITICAL')}
          className={`tactile-press text-left rounded-lg border p-5 transition-all ${
            filterStatus === 'CRITICAL'
              ? 'border-status-critical bg-[var(--status-critical-bg)] ring-1 ring-status-critical'
              : 'border-[var(--status-critical-border)] bg-surface hover:bg-[var(--status-critical-bg)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-status-critical">
              Critical Priority
            </span>
            <AlertTriangle className="h-4 w-4 text-status-critical" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-status-critical">
            {metrics.criticalCount}
          </p>
          <span className="mt-1 block text-xs text-stem">
            Requires immediate medical intervention
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('WARNING')}
          className={`tactile-press text-left rounded-lg border p-5 transition-all ${
            filterStatus === 'WARNING'
              ? 'border-status-caution bg-[var(--status-caution-bg)] ring-1 ring-status-caution'
              : 'border-[var(--status-caution-border)] bg-surface hover:bg-[var(--status-caution-bg)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-status-caution">
              Observation / Watch
            </span>
            <ShieldAlert className="h-4 w-4 text-status-caution" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-status-caution">
            {metrics.warningCount}
          </p>
          <span className="mt-1 block text-xs text-stem">
            Parameters near HRP tolerance limits
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('OK')}
          className={`tactile-press text-left rounded-lg border p-5 transition-all ${
            filterStatus === 'OK'
              ? 'border-status-nominal bg-[var(--status-nominal-bg)] ring-1 ring-status-nominal'
              : 'border-[var(--status-nominal-border)] bg-surface hover:bg-[var(--status-nominal-bg)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-status-nominal">
              Nominal Condition
            </span>
            <CheckCircle2 className="h-4 w-4 text-status-nominal" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-status-nominal">
            {metrics.nominalCount}
          </p>
          <span className="mt-1 block text-xs text-stem">
            Biometrics within nominal range
          </span>
        </button>
      </div>

      {/* Search and filter bar — borderless inline controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stem" />
          <input
            type="text"
            placeholder="Filter by astronaut, role, or mission..."
            aria-label="Filter crew members"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ui-input pl-6 text-sm placeholder:text-stem/70"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`tactile-press py-1.5 text-xs font-semibold tabular-nums transition-colors ${
              filterStatus === 'ALL'
                ? 'border-b-2 border-plate text-blueberry'
                : 'text-stem hover:text-blueberry'
            }`}
          >
            All ({crew.length})
          </button>

          <button
            type="button"
            onClick={fetchTriage}
            className="tactile-press ml-auto sm:ml-2 flex items-center gap-1.5 py-1.5 text-xs font-semibold text-berry hover:text-blueberry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Triage grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredCrew.length === 0 ? (
        <div className="surface-tinted p-12 text-center text-sm text-stem">
          No astronauts match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCrew.map((astronaut) => {
            const isCritical = astronaut.status === 'CRITICAL';
            const isWarning = astronaut.status === 'WARNING';

            return (
              <article
                key={astronaut.astronautId}
                className={`surface-card flex flex-col justify-between p-6 transition-all duration-ui ease-out-expo hover:shadow-md ${
                  isCritical
                    ? 'border-[var(--status-critical-border)]'
                    : isWarning
                    ? 'border-[var(--status-caution-border)]'
                    : 'border-line'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {astronaut.photoUrl ? (
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                          <Image
                            src={astronaut.photoUrl}
                            alt={astronaut.astronautName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <AstronautFallbackAvatar
                          name={astronaut.astronautName}
                          className="h-14 w-14 flex-shrink-0"
                        />
                      )}

                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-blueberry">
                          {astronaut.astronautName}
                        </h3>
                        <p className="text-xs text-berry truncate">
                          {astronaut.role} · {astronaut.missionName}
                        </p>
                        <span className="mt-0.5 block font-mono text-[11px] text-stem">
                          Habitat: {astronaut.environment}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isCritical && (
                        <span className="ui-badge text-status-critical">
                          <span className="h-2 w-2 rounded-full bg-status-critical" aria-hidden="true" />
                          <span>Critical</span>
                        </span>
                      )}
                      {isWarning && (
                        <span className="ui-badge text-status-caution">
                          <span className="h-2 w-2 rounded-full bg-status-caution" aria-hidden="true" />
                          <span>Watch</span>
                        </span>
                      )}
                      {!isCritical && !isWarning && (
                        <span className="ui-badge text-status-nominal">
                          <span className="h-2 w-2 rounded-full bg-status-nominal" aria-hidden="true" />
                          <span>Nominal</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vital signs grid — flat typographic values, no inner boxes */}
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
                    <div>
                      <span className="text-[11px] text-stem block">HR (bpm)</span>
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          astronaut.heartRate > 100 || astronaut.heartRate < 50
                            ? 'text-status-critical'
                            : 'text-blueberry'
                        }`}
                      >
                        {astronaut.heartRate} bpm
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">BP (mmHg)</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-blueberry">
                        {astronaut.bloodPressure}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">SpO₂ (%)</span>
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          astronaut.spo2 < 95 ? 'text-status-caution' : 'text-blueberry'
                        }`}
                      >
                        {astronaut.spo2}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">Temp (°C)</span>
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          astronaut.temperature > 37.8 ? 'text-status-critical' : 'text-blueberry'
                        }`}
                      >
                        {astronaut.temperature}°C
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">Glucose</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-blueberry">
                        {astronaut.glucose} mg/dL
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">Sleep</span>
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          astronaut.sleepHours < 6 ? 'text-status-caution' : 'text-blueberry'
                        }`}
                      >
                        {astronaut.sleepHours} hrs
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">Mood (1–5)</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-blueberry">
                        {astronaut.mood}/5
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-stem block">Last Reading</span>
                      <span className="font-mono text-xs tabular-nums text-berry">
                        {new Date(astronaut.lastReadingAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Active medical alerts */}
                  {astronaut.alerts && astronaut.alerts.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <span className="text-xs font-semibold text-status-critical block">
                        Active medical alerts
                      </span>
                      {astronaut.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="ui-callout-critical flex items-center gap-2 text-xs text-status-critical"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                          <span>{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active directive */}
                  {astronaut.recommendation && (
                    <div className="mt-6 ui-callout text-xs text-blueberry">
                      <span className="font-semibold text-berry block mb-0.5">
                        Active clinical directive
                      </span>
                      {astronaut.recommendation}
                    </div>
                  )}
                </div>

                {/* Surgeon actions */}
                <div className="mt-6 pt-2 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/trends?astronautId=${astronaut.astronautId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-berry hover:text-blueberry underline underline-offset-4"
                  >
                    <span>Analyze trends</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCrew(astronaut);
                      setDirectiveText('');
                      setFeedbackMessage(null);
                    }}
                    className="tactile-press inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-blueberry hover:border-blueberry hover:bg-surface-tinted"
                  >
                    <Send className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                    <span>Issue Medical Directive</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal for issuing clinical directive */}
      {selectedCrew && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="directive-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-blueberry/25 p-4 backdrop-blur-sm animate-materialize"
        >
          <div className="surface-elevated w-full max-w-lg border border-line p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h3
                  id="directive-modal-title"
                  className="text-lg font-bold text-blueberry"
                >
                  Clinical Directive for {selectedCrew.astronautName}
                </h3>
                <p className="mt-0.5 text-xs text-stem">
                  Mission: {selectedCrew.missionName} · Module: {selectedCrew.environment}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCrew(null)}
                aria-label="Close dialog"
                className="tactile-press flex h-8 w-8 items-center justify-center rounded-pill text-stem hover:bg-surface-subtle hover:text-blueberry"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedbackMessage ? (
              <div className="rounded-lg border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] p-5 text-center text-xs text-status-nominal">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2" />
                <p className="font-medium">{feedbackMessage}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="directive-textarea"
                    className="text-xs font-semibold text-blueberry block"
                  >
                    Medical instruction or countermeasure protocol
                  </label>
                  <textarea
                    id="directive-textarea"
                    rows={4}
                    value={directiveText}
                    onChange={(e) => setDirectiveText(e.target.value)}
                    placeholder="e.g. Increase ARED session to 75 min, hydrate with 500 mL Ringer-lactate solution, and rest for 4 hours..."
                    className="w-full rounded-md border border-line bg-surface-subtle p-3 text-sm text-blueberry placeholder:text-stem/60 focus:border-blueberry focus:bg-surface focus:outline-none focus:ring-1 focus:ring-blueberry"
                  />
                  <span className="text-[11px] text-stem block">
                    The directive will be transmitted with acknowledgment and logged in the crew
                    member&apos;s medical record.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSelectedCrew(null)}
                    className="tactile-press rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold text-berry hover:border-blueberry hover:text-blueberry"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSendingDirective || !directiveText.trim()}
                    onClick={handleSendDirective}
                    className="tactile-press inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
                  >
                    {isSendingDirective ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Transmitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Transmit to Capsule</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
