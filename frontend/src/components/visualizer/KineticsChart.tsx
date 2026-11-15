'use client';

import { useState } from 'react';
import type { ShieldingKineticsResult, ShieldingType } from '../../services/biophysicsService';

interface KineticsChartProps {
  shieldingResults: Record<ShieldingType, ShieldingKineticsResult>;
  selectedShielding: ShieldingType;
}

const SHIELDING_COLORS: Record<ShieldingType, { stroke: string; label: string }> = {
  EVA_SUIT: { stroke: 'hsl(354, 78%, 66%)', label: 'EVA Suit' },
  CREW_CABIN_NOMINAL: { stroke: 'hsl(220, 32%, 76%)', label: 'Crew Cabin' },
  STORM_SHELTER: { stroke: 'hsl(152, 55%, 58%)', label: 'Storm Shelter' },
};

const CLINICAL_THRESHOLD = {
  gammaH2ax: { value: 12.0, label: 'DSB Repair Saturation (12 foci/cell)' },
  urine8Ohdg: { value: 35.0, label: 'Elevated Oxidative Stress (35 ng/mg)' },
};

export function KineticsChart({ shieldingResults, selectedShielding }: KineticsChartProps) {
  const [metric, setMetric] = useState<'gammaH2ax' | 'urine8Ohdg'>('gammaH2ax');
  const [hiddenSeries, setHiddenSeries] = useState<Partial<Record<ShieldingType, boolean>>>({});
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 620;
  const height = 250;
  const pad = { top: 20, right: 20, bottom: 32, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const seriesOrder: ShieldingType[] = ['EVA_SUIT', 'CREW_CABIN_NOMINAL', 'STORM_SHELTER'];
  const visibleSeries = seriesOrder.filter((s) => !hiddenSeries[s]);
  const allPoints = (visibleSeries.length ? visibleSeries : seriesOrder).flatMap(
    (s) => shieldingResults[s].curve
  );

  const threshold = CLINICAL_THRESHOLD[metric];
  const maxT = Math.max(...allPoints.map((p) => p.timeHours), 24);
  const rawMaxY = Math.max(
    ...allPoints.map((p) => (metric === 'gammaH2ax' ? p.gammaH2axFociPerCell : p.urine8OhdgNgMg)),
    threshold.value * 0.9,
    metric === 'gammaH2ax' ? 4 : 25
  );
  const maxY = rawMaxY * 1.12;

  const toX = (t: number) => pad.left + (t / maxT) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxY) * plotH;

  const activeWindow = shieldingResults[selectedShielding].urineSamplingWindow;
  const refCurve = shieldingResults[selectedShielding].curve;

  const toggleSeries = (s: ShieldingType) => {
    setHiddenSeries((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!refCurve.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const t = ((svgX - pad.left) / plotW) * maxT;
    if (t < 0 || t > maxT) {
      setHoverIdx(null);
      return;
    }
    let bestIdx = 0;
    let bestDist = Infinity;
    refCurve.forEach((p, idx) => {
      const d = Math.abs(p.timeHours - t);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    setHoverIdx(bestIdx);
  };

  const hoverPoint = hoverIdx !== null ? refCurve[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMetric('gammaH2ax')}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${
              metric === 'gammaH2ax'
                ? 'border border-berry bg-surface-hover text-blueberry'
                : 'border border-line text-stem hover:text-blueberry'
            }`}
          >
            γ-H2AX (DSB Foci/cell)
          </button>
          <button
            type="button"
            onClick={() => setMetric('urine8Ohdg')}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${
              metric === 'urine8Ohdg'
                ? 'border border-status-caution bg-[var(--status-caution-bg)] text-status-caution'
                : 'border border-line text-stem hover:text-blueberry'
            }`}
          >
            Urinary 8-OHdG (ng/mg)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          {seriesOrder.map((s) => {
            const isHidden = Boolean(hiddenSeries[s]);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeries(s)}
                aria-pressed={!isHidden}
                title="Toggle shielding curve"
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 transition ${
                  isHidden
                    ? 'border-line opacity-45 text-stem'
                    : s === selectedShielding
                      ? 'border-berry bg-surface-subtle text-blueberry font-semibold'
                      : 'border-line text-stem hover:text-blueberry'
                }`}
              >
                <span
                  className="h-2 w-2.5 rounded-sm"
                  style={{ backgroundColor: SHIELDING_COLORS[s].stroke }}
                />
                <span>{SHIELDING_COLORS[s].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-line bg-canvas p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Biomarker ODE Kinetics"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Optimal urine sampling window band */}
          {metric === 'urine8Ohdg' && (
            <g>
              <rect
                x={toX(activeWindow.startHour)}
                y={pad.top}
                width={Math.max(4, toX(activeWindow.endHour) - toX(activeWindow.startHour))}
                height={plotH}
                fill="hsla(36, 88%, 62%, 0.12)"
              />
              <line
                x1={toX(activeWindow.peakHour)}
                x2={toX(activeWindow.peakHour)}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="hsl(36, 88%, 62%)"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={toX(activeWindow.peakHour) + 4}
                y={pad.top + 12}
                fill="hsl(36, 88%, 62%)"
                fontSize="10"
                fontFamily="monospace"
              >
                Sample Window ({activeWindow.startHour.toFixed(0)}–{activeWindow.endHour.toFixed(0)}h)
              </text>
            </g>
          )}

          {/* Clinical Threshold Line */}
          {threshold.value <= maxY && (
            <g>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={toY(threshold.value)}
                y2={toY(threshold.value)}
                stroke="hsla(354, 78%, 66%, 0.55)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={width - pad.right - 4}
                y={toY(threshold.value) - 4}
                textAnchor="end"
                fill="hsl(354, 78%, 66%)"
                fontSize="9.5"
                fontFamily="monospace"
              >
                {threshold.label}
              </text>
            </g>
          )}

          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const val = maxY * frac;
            const y = toY(val);
            return (
              <g key={frac}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                />
                <text
                  x={pad.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {[0, 6, 12, 18, 24, 30, 36]
            .filter((t) => t <= maxT)
            .map((t) => (
              <text
                key={t}
                x={toX(t)}
                y={height - 10}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {t}h
              </text>
            ))}

          {/* Curves */}
          {seriesOrder.map((s) => {
            if (hiddenSeries[s]) return null;
            const pts = shieldingResults[s].curve;
            const d = pts
              .map((p, idx) => {
                const yVal = metric === 'gammaH2ax' ? p.gammaH2axFociPerCell : p.urine8OhdgNgMg;
                return `${idx === 0 ? 'M' : 'L'}${toX(p.timeHours).toFixed(1)},${toY(yVal).toFixed(1)}`;
              })
              .join(' ');
            const isSelected = s === selectedShielding;
            return (
              <path
                key={s}
                d={d}
                fill="none"
                stroke={SHIELDING_COLORS[s].stroke}
                strokeWidth={isSelected ? 2.6 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.65}
              />
            );
          })}

          {/* Hover Crosshair & Points */}
          {hoverPoint && hoverIdx !== null && (
            <g>
              <line
                x1={toX(hoverPoint.timeHours)}
                x2={toX(hoverPoint.timeHours)}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1"
              />
              {seriesOrder.map((s) => {
                if (hiddenSeries[s]) return null;
                const pt = shieldingResults[s].curve[hoverIdx];
                if (!pt) return null;
                const yVal = metric === 'gammaH2ax' ? pt.gammaH2axFociPerCell : pt.urine8OhdgNgMg;
                return (
                  <circle
                    key={s}
                    cx={toX(pt.timeHours)}
                    cy={toY(yVal)}
                    r={3.5}
                    fill={SHIELDING_COLORS[s].stroke}
                    stroke="#060911"
                    strokeWidth="1.2"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoverPoint && hoverIdx !== null && (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 pt-1.5 font-mono text-[11px] text-stem">
            <span className="text-blueberry font-semibold">T+{hoverPoint.timeHours.toFixed(1)}h</span>
            <div className="flex flex-wrap gap-3">
              {seriesOrder.map((s) => {
                if (hiddenSeries[s]) return null;
                const pt = shieldingResults[s].curve[hoverIdx];
                if (!pt) return null;
                const val = metric === 'gammaH2ax' ? pt.gammaH2axFociPerCell : pt.urine8OhdgNgMg;
                const unit = metric === 'gammaH2ax' ? 'foci' : 'ng/mg';
                return (
                  <span key={s} style={{ color: SHIELDING_COLORS[s].stroke }}>
                    {SHIELDING_COLORS[s].label}: {val.toFixed(1)} {unit}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
