'use client';

/**
 * @module health/components/twin/ThresholdSlider
 * Range slider with an embedded deterministic threshold gradient track and baseline marker.
 */

import { useId, useMemo } from 'react';
import { evaluateIndicator } from '../../domain/evaluate';
import { INDICATORS } from '../../domain/indicators';
import { STATUS_THEME } from '../../domain/status-theme';
import type { IndicatorId } from '../../domain/types';
import { bandGradient, positionPct } from './twinMeta';

interface ThresholdSliderProps {
  indicator: IndicatorId;
  value: number;
  baseline?: number;
  domain: [number, number];
  step?: number;
  onChange: (value: number) => void;
}

/**
 * Range input whose track is painted with the rule engine's own green/amber/red
 * bands (from INDICATORS thresholds), so the user sees where each zone flips.
 */
export function ThresholdSlider({ indicator, value, baseline, domain, step, onChange }: ThresholdSliderProps) {
  const id = useId();
  const def = INDICATORS[indicator];
  const [min, max] = domain;
  const status = evaluateIndicator(indicator, value).status;
  const theme = STATUS_THEME[status];

  const track = useMemo(() => bandGradient(indicator, [min, max]), [indicator, min, max]);
  const pct = (v: number) => positionPct(v, [min, max]);
  const delta = baseline !== undefined ? +(value - baseline).toFixed(1) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="twin-label">
          {def.label.replace(' (resting)', '')}
        </label>
        <span className="flex items-baseline gap-1.5">
          {delta !== 0 && (
            <span className="twin-value text-[11px] text-stem">
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
          <span className="twin-value text-sm font-bold" style={{ color: theme.color }}>
            {value}
          </span>
          <span className="text-[11px] text-stem">{def.unit}</span>
        </span>
      </div>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ background: track }}
        />
        {baseline !== undefined && (
          <div
            aria-hidden="true"
            title={`Last reading: ${baseline} ${def.unit}`}
            className="pointer-events-none absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-plate/70"
            style={{ left: `${pct(baseline)}%` }}
          />
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step ?? def.input.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${value} ${def.unit}, ${theme.label}`}
          className="twin-range relative"
          style={{ ['--thumb-color' as string]: theme.color }}
        />
      </div>
    </div>
  );
}
