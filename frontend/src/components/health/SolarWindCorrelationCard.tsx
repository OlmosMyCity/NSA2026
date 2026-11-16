'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Wind } from 'lucide-react';
import { INDICATORS } from '@/domain/health/indicators';
import {
  ELEVATED_WIND_THRESHOLD_KMS,
  buildSolarWindSeries,
  correlateSolarWindWithVitals,
  indicatorSolarNote,
} from '@/domain/health/solarWind';
import type { TrendPoint } from '@/domain/health/trends';
import type { IndicatorId } from '@/domain/health/types';
import { radiationService, type RadiationStatusResponse } from '@/services/radiationService';

interface SolarWindCorrelationCardProps {
  indicator: IndicatorId;
  points: TrendPoint[];
}

const fullFmt = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dayFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

export function SolarWindCorrelationCard({ indicator, points }: SolarWindCorrelationCardProps) {
  const def = INDICATORS[indicator];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [radStatus, setRadStatus] = useState<RadiationStatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    radiationService.getStatus().then((res) => {
      if (alive) setRadStatus(res);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const solarSeries = useMemo(
    () => buildSolarWindSeries(points, radStatus),
    [points, radStatus],
  );
  const stats = useMemo(
    () => correlateSolarWindWithVitals(points, solarSeries),
    [points, solarSeries],
  );

  if (!points.length || !solarSeries.length) return null;

  const height = 220;
  const m = { l: 44, r: 52, t: 14, b: 28 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;

  const vVals = points.map((p) => p.value);
  const vMinRaw = Math.min(...vVals);
  const vMaxRaw = Math.max(...vVals);
  const vPad = Math.max((vMaxRaw - vMinRaw) * 0.15, def.input.step);
  const vLo = vMinRaw - vPad;
  const vHi = vMaxRaw + vPad;

  const sVals = solarSeries.map((s) => s.speedKmS);
  const sLo = Math.min(300, Math.floor((Math.min(...sVals) - 40) / 50) * 50);
  const sHi = Math.max(700, Math.ceil((Math.max(...sVals) + 40) / 50) * 50);

  const xAt = (i: number) =>
    points.length <= 1 ? m.l + iw / 2 : m.l + (i / (points.length - 1)) * iw;
  const yVital = (v: number) => m.t + (1 - (v - vLo) / (vHi - vLo || 1)) * ih;
  const ySolar = (s: number) => m.t + (1 - (s - sLo) / (sHi - sLo || 1)) * ih;

  const vitalPath = points
    .map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yVital(p.value).toFixed(1)}`)
    .join('');
  const solarPath = solarSeries
    .map((s, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${ySolar(s.speedKmS).toFixed(1)}`)
    .join('');

  const fmt = (v: number) => (Number.isInteger(def.input.step) ? Math.round(v) : v.toFixed(1));
  const activePoint = activeIdx !== null ? points[activeIdx] : null;
  const activeSolar = activeIdx !== null ? solarSeries[activeIdx] : null;

  const xTickIndices = Array.from(
    new Set(
      [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
        (i) => i >= 0 && i < points.length,
      ),
    ),
  );

  return (
    <section
      aria-labelledby="solar-corr-title"
      className="surface-card p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h2 id="solar-corr-title" className="text-lg font-bold text-blueberry">
              Solar Wind &amp; {def.label} Correlation
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-stem">
            {indicatorSolarNote(indicator)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-blueberry">
            <span className="h-0.5 w-4 rounded bg-sky-400" aria-hidden="true" />
            {def.label} ({def.unit})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
            <span
              className="h-0.5 w-4 border-b-2 border-dashed border-amber-400"
              aria-hidden="true"
            />
            Solar Wind (km/s)
          </span>
        </div>
      </div>

      {/* Statistical Correlation Summary */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-line bg-surface-tinted/50 p-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-stem">Pearson Correlation (r)</dt>
          <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
            {stats.pearsonR >= 0 ? '+' : ''}
            {stats.pearsonR.toFixed(2)}{' '}
            <span className="text-xs font-medium text-stem">
              · {stats.strengthLabel} {stats.directionLabel}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-stem">
            Nominal Wind (&lt;{ELEVATED_WIND_THRESHOLD_KMS} km/s)
          </dt>
          <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
            {stats.nominalAvg !== null ? `${fmt(stats.nominalAvg)} ${def.unit}` : '—'}{' '}
            <span className="text-xs font-normal text-stem">
              ({stats.nominalCount} pts)
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-stem">
            Elevated Wind / Storm (&ge;{ELEVATED_WIND_THRESHOLD_KMS} km/s)
          </dt>
          <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
            {stats.stormAvg !== null ? `${fmt(stats.stormAvg)} ${def.unit}` : '—'}{' '}
            {stats.deltaPct !== null && (
              <span
                className={`text-xs font-semibold tabular-nums ${
                  Math.abs(stats.deltaPct) >= 5 ? 'text-amber-300' : 'text-stem'
                }`}
              >
                ({stats.deltaPct >= 0 ? '+' : ''}
                {stats.deltaPct.toFixed(1)}%)
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/* Dual-Axis SVG Overlay Chart */}
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Solar wind speed compared with ${def.label} across ${points.length} readings.`}
            onPointerMove={(e) => {
              if (points.length <= 1 || iw <= 0) {
                setActiveIdx(0);
                return;
              }
              const r = e.currentTarget.getBoundingClientRect();
              const idx = Math.round(((e.clientX - r.left - m.l) / iw) * (points.length - 1));
              setActiveIdx(Math.min(points.length - 1, Math.max(0, idx)));
            }}
            onPointerLeave={() => setActiveIdx(null)}
            className="block touch-none"
          >
            {/* Shaded elevated solar wind windows (>= 520 km/s) */}
            {solarSeries.map((s, i) => {
              if (s.speedKmS < ELEVATED_WIND_THRESHOLD_KMS || points.length <= 1) return null;
              const segW = Math.max(4, iw / (points.length - 1));
              const x0 = Math.max(m.l, xAt(i) - segW / 2);
              return (
                <rect
                  key={`storm-${i}`}
                  x={x0}
                  y={m.t}
                  width={Math.min(segW, m.l + iw - x0)}
                  height={ih}
                  fill="rgb(245, 158, 11)"
                  opacity={0.12}
                />
              );
            })}

            {/* Threshold line at 520 km/s */}
            <line
              x1={m.l}
              x2={m.l + iw}
              y1={ySolar(ELEVATED_WIND_THRESHOLD_KMS)}
              y2={ySolar(ELEVATED_WIND_THRESHOLD_KMS)}
              stroke="rgba(217, 119, 6, 0.35)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            {/* Left Y labels (Vital) */}
            <text x={m.l - 6} y={m.t + 6} textAnchor="end" className="fill-[hsl(var(--hsl-ink-muted))] text-[10px] tabular-nums">
              {fmt(vHi)}
            </text>
            <text x={m.l - 6} y={m.t + ih} textAnchor="end" className="fill-[hsl(var(--hsl-ink-muted))] text-[10px] tabular-nums">
              {fmt(vLo)}
            </text>

            {/* Right Y labels (Solar Wind km/s) */}
            <text x={m.l + iw + 6} y={m.t + 6} textAnchor="start" className="fill-amber-300 text-[10px] tabular-nums">
              {sHi} km/s
            </text>
            <text x={m.l + iw + 6} y={m.t + ih} textAnchor="start" className="fill-amber-300 text-[10px] tabular-nums">
              {sLo} km/s
            </text>

            {/* X axis labels */}
            {xTickIndices.map((idx, i) => (
              <text
                key={idx}
                x={xAt(idx)}
                y={height - 6}
                textAnchor={
                  xTickIndices.length === 1
                    ? 'middle'
                    : i === 0
                      ? 'start'
                      : i === xTickIndices.length - 1
                        ? 'end'
                        : 'middle'
                }
                className="fill-[hsl(var(--hsl-ink-muted))] text-[10px] tabular-nums"
              >
                {dayFmt.format(points[idx].t)}
              </text>
            ))}

            {/* Solar Wind dashed curve */}
            <path
              d={solarPath}
              fill="none"
              stroke="#FBBF24"
              strokeWidth={2}
              strokeDasharray="5 3"
              strokeLinejoin="round"
            />

            {/* Vital Sign halo & solid curve */}
            <path
              d={vitalPath}
              fill="none"
              stroke="hsl(223, 29%, 6%)"
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={vitalPath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {activeIdx !== null && activePoint && activeSolar && (
              <>
                <line
                  x1={xAt(activeIdx)}
                  x2={xAt(activeIdx)}
                  y1={m.t}
                  y2={m.t + ih}
                  stroke="#7DD3FC"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xAt(activeIdx)}
                  cy={yVital(activePoint.value)}
                  r={4.5}
                  fill="#38BDF8"
                  stroke="#F5F6F3"
                  strokeWidth={1.5}
                />
                <circle
                  cx={xAt(activeIdx)}
                  cy={ySolar(activeSolar.speedKmS)}
                  r={4.5}
                  fill="#FBBF24"
                  stroke="#F5F6F3"
                  strokeWidth={1.5}
                />
              </>
            )}
          </svg>
        )}

        {activeIdx !== null && activePoint && activeSolar && (
          <div
            className="pointer-events-none absolute z-10 w-52 surface-elevated px-3 py-2 text-xs"
            style={{
              left:
                xAt(activeIdx) + 216 > width
                  ? Math.max(0, xAt(activeIdx) - 216)
                  : xAt(activeIdx) + 12,
              top: 8,
            }}
          >
            <div className="font-semibold text-blueberry tabular-nums">
              {fmt(activePoint.value)} {def.unit}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-amber-300 font-medium tabular-nums">
              <Sun className="h-3 w-3" aria-hidden="true" />
              <span>
                {activeSolar.speedKmS} km/s · Kp {activeSolar.kpIndex} · {activeSolar.protonFluxPfu} pfu
              </span>
            </div>
            <div className="mt-0.5 text-stem">{fullFmt.format(activePoint.t)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
