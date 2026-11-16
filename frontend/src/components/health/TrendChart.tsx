'use client';

/**
 * @module components/health/TrendChart
 * Responsive SVG time-series chart with deterministic green/amber/red threshold
 * background bands (`statusBands`), ResizeObserver layout, pointer crosshair,
 * and keyboard arrow-key point navigation.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { INDICATORS } from '../../domain/health/indicators';
import { STATUS_THEME } from '../../domain/health/status-theme';
import { statusBands, trendDomain, type TrendPoint } from '../../domain/health/trends';
import type { IndicatorId } from '../../domain/health/types';

/** Chart stroke and hairline colors synchronized with global HSL design tokens. */
const LINE = 'hsl(223, 29%, 26%)';       /* Blueberry Skin */
const SURFACE = 'hsl(80, 14%, 99%)';     /* Surface White */
const GRID = 'hsl(27, 14%, 85%)';        /* Yogurt hairline */
const CROSSHAIR = 'hsl(220, 20%, 45%)';  /* Berry Bloom */

interface TrendChartProps {
  indicator: IndicatorId;
  points: TrendPoint[];
  height?: number;
  compact?: boolean;
}

const dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const fullFmt = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Computes readable Y-axis tick intervals (1, 2, 2.5, 5, 10 × 10^n) across `[lo, hi]`. */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/** Renders a full or compact sparkline SVG chart with threshold bands and hover tooltip. */
export function TrendChart({
  indicator,
  points,
  height = 280,
  compact = false,
}: TrendChartProps) {
  const def = INDICATORS[indicator];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = compact ? { l: 8, r: 8, t: 8, b: 8 } : { l: 44, r: 64, t: 12, b: 28 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;

  const yDomain = useMemo(() => trendDomain(indicator, points), [indicator, points]);
  const bands = useMemo(() => statusBands(indicator, yDomain), [indicator, yDomain]);
  const ticks = useMemo(() => niceTicks(yDomain[0], yDomain[1]), [yDomain]);

  const xAt = (i: number) =>
    points.length <= 1 ? m.l + iw / 2 : m.l + (i / (points.length - 1)) * iw;
  const y = (v: number) => m.t + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * ih;

  const xTicks = useMemo(() => {
    if (!points.length) return [];
    if (points.length === 1) return [0];
    const target = Math.min(points.length, width < 480 ? 3 : 5);
    const indices = new Set<number>();
    for (let k = 0; k < target; k++) {
      indices.add(Math.round((k / (target - 1)) * (points.length - 1)));
    }
    return Array.from(indices);
  }, [points.length, width]);

  const useTimeLabels = useMemo(() => {
    if (xTicks.length < 2) return true;
    const labels = xTicks.map((idx) => dayFmt.format(points[idx].t));
    return new Set(labels).size < labels.length;
  }, [xTicks, points]);

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const lastIndex = points.length - 1;
  const last = points.at(-1);
  const current = active !== null ? points[active] : null;

  const nearest = (px: number) => {
    if (points.length <= 1 || iw <= 0) return 0;
    const idx = Math.round(((px - m.l) / iw) * (points.length - 1));
    return Math.min(points.length - 1, Math.max(0, idx));
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearest(e.clientX - r.left));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + d)));
    }
  };

  const fmt = (v: number) => (Number.isInteger(def.input.step) ? Math.round(v) : v.toFixed(1));

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={compact ? -1 : 0}
          aria-label={`${def.label}: ${points.length} measurements${last ? `, latest ${fmt(last.value)} ${def.unit}, ${STATUS_THEME[last.status].label}` : ''}. Use arrow keys to browse points.`}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-blueberry rounded-md"
        >
          {bands.map((b, i) => (
            <rect
              key={i}
              x={m.l}
              width={iw}
              y={y(b.to)}
              height={Math.max(0, y(b.from) - y(b.to))}
              fill={STATUS_THEME[b.status].color}
              opacity={b.status === 'green' ? 0.08 : 0.14}
            />
          ))}

          {!compact &&
            ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text
                  x={m.l - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-stem text-[11px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            ))}

          {!compact &&
            xTicks.map((idx, i) => (
              <text
                key={idx}
                x={xAt(idx)}
                y={height - 8}
                textAnchor={
                  xTicks.length === 1
                    ? 'middle'
                    : i === 0
                      ? 'start'
                      : i === xTicks.length - 1
                        ? 'end'
                        : 'middle'
                }
                className="fill-stem text-[11px]"
              >
                {(useTimeLabels ? timeFmt : dayFmt).format(points[idx].t)}
              </text>
            ))}

          {current && active !== null && (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={m.t}
              y2={m.t + ih}
              stroke={CROSSHAIR}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <path
            d={path}
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p, i) =>
            p.status === 'amber' || p.status === 'red' || i === lastIndex || i === active ? (
              <circle
                key={`${p.t}-${i}`}
                cx={xAt(i)}
                cy={y(p.value)}
                r={i === active ? 5 : 4}
                fill={p.status === 'amber' || p.status === 'red' ? STATUS_THEME[p.status].color : LINE}
                stroke={SURFACE}
                strokeWidth={2}
              />
            ) : null,
          )}

          {!compact && last && (
            <text
              x={xAt(lastIndex) + 10}
              y={y(last.value)}
              dy="0.32em"
              className="fill-blueberry text-xs font-bold tabular-nums"
            >
              {fmt(last.value)}
              <tspan className="fill-stem font-normal"> {def.unit}</tspan>
            </text>
          )}
        </svg>
      )}

      {current && active !== null && !compact && (
        <div
          className="pointer-events-none absolute z-10 w-44 surface-elevated px-3 py-2 text-xs"
          style={{
            left: xAt(active) + 184 > width ? Math.max(0, xAt(active) - 184) : xAt(active) + 12,
            top: Math.min(Math.max(0, y(current.value) - 36), height - 84),
          }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ backgroundColor: LINE }} />
            <strong className="text-sm font-bold text-blueberry tabular-nums">
              {fmt(current.value)} {def.unit}
            </strong>
          </div>
          <div className="mt-0.5 text-stem">{fullFmt.format(current.t)}</div>
          <div className="mt-1 font-medium text-blueberry">
            <span aria-hidden="true" style={{ color: STATUS_THEME[current.status].color }}>
              {STATUS_THEME[current.status].icon}
            </span>{' '}
            {current.status === 'red' ? 'Critical' : STATUS_THEME[current.status].label}
          </div>
        </div>
      )}
    </div>
  );
}

