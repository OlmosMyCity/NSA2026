'use client';

import { useState } from 'react';
import type { ShieldingKineticsResult, ShieldingType } from '../services/biophysicsService';

interface KineticsChartProps {
  shieldingResults: Record<ShieldingType, ShieldingKineticsResult>;
  selectedShielding: ShieldingType;
}

const SHIELDING_COLORS: Record<ShieldingType, { stroke: string; label: string }> = {
  EVA_SUIT: { stroke: '#f43f5e', label: 'EVA Suit' },
  CREW_CABIN_NOMINAL: { stroke: '#38bdf8', label: 'Crew Cabin' },
  STORM_SHELTER: { stroke: '#34d399', label: 'Storm Shelter' },
};

export function KineticsChart({ shieldingResults, selectedShielding }: KineticsChartProps) {
  const [metric, setMetric] = useState<'gammaH2ax' | 'urine8Ohdg'>('gammaH2ax');

  const width = 620;
  const height = 240;
  const pad = { top: 18, right: 20, bottom: 32, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const seriesOrder: ShieldingType[] = ['EVA_SUIT', 'CREW_CABIN_NOMINAL', 'STORM_SHELTER'];
  const allPoints = seriesOrder.flatMap((s) => shieldingResults[s].curve);

  const maxT = Math.max(...allPoints.map((p) => p.timeHours), 24);
  const rawMaxY = Math.max(
    ...allPoints.map((p) => (metric === 'gammaH2ax' ? p.gammaH2axFociPerCell : p.urine8OhdgNgMg)),
    metric === 'gammaH2ax' ? 4 : 25
  );
  const maxY = rawMaxY * 1.12;

  const toX = (t: number) => pad.left + (t / maxT) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxY) * plotH;

  const activeWindow = shieldingResults[selectedShielding].urineSamplingWindow;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMetric('gammaH2ax')}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${
              metric === 'gammaH2ax'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
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
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                : 'border border-line text-stem hover:text-blueberry'
            }`}
          >
            Urinary 8-OHdG (ng/mg)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          {seriesOrder.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-stem">
              <span
                className="h-2 w-3 rounded-sm"
                style={{ backgroundColor: SHIELDING_COLORS[s].stroke }}
              />
              <span className={s === selectedShielding ? 'font-bold text-blueberry' : ''}>
                {SHIELDING_COLORS[s].label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#070d18] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Biomarker ODE Kinetics">
          {/* Optimal urine sampling window band */}
          {metric === 'urine8Ohdg' && (
            <g>
              <rect
                x={toX(activeWindow.startHour)}
                y={pad.top}
                width={Math.max(4, toX(activeWindow.endHour) - toX(activeWindow.startHour))}
                height={plotH}
                fill="rgba(251, 191, 36, 0.14)"
              />
              <line
                x1={toX(activeWindow.peakHour)}
                x2={toX(activeWindow.peakHour)}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={toX(activeWindow.peakHour) + 4}
                y={pad.top + 12}
                fill="#fcd34d"
                fontSize="10"
                fontFamily="monospace"
              >
                Sample Window ({activeWindow.startHour.toFixed(0)}–{activeWindow.endHour.toFixed(0)}h)
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
        </svg>
      </div>
    </div>
  );
}
