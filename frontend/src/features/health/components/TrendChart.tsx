'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { INDICATORS } from '../domain/indicators';
import { STATUS_THEME } from '../domain/status-theme';
import { statusBands, trendDomain, type TrendPoint } from '../domain/trends';
import type { IndicatorId } from '../domain/types';

/** Colores sincronizados con los tokens CSS globales (HSL). */
const LINE = 'hsl(223, 29%, 26%)';       /* Blueberry Skin */
const SURFACE = 'hsl(80, 14%, 99%)';     /* Surface White */
const GRID = 'hsl(27, 14%, 85%)';        /* Yogurt hairline */
const CROSSHAIR = 'hsl(220, 20%, 45%)';  /* Berry Bloom */

interface TrendChartProps {
  indicator: IndicatorId;
  points: TrendPoint[];
  xDomain: [number, number];
  height?: number;
  compact?: boolean;
}

const dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function TrendChart({
  indicator,
  points,
  xDomain,
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

  const x = (t: number) => m.l + ((t - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * iw;
  const y = (v: number) => m.t + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * ih;

  const xTicks = useMemo(() => {
    const n = width < 480 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / (n - 1));
  }, [xDomain, width]);

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = points.at(-1);
  const current = active !== null ? points[active] : null;

  const nearest = (px: number) => {
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    });
    return best;
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
          aria-label={`${def.label}: ${points.length} mediciones${last ? `, última ${fmt(last.value)} ${def.unit}, ${STATUS_THEME[last.status].label}` : ''}. Usa las flechas para recorrer los puntos.`}
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
            xTicks.map((t, i) => (
              <text
                key={t}
                x={x(t)}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                className="fill-stem text-[11px]"
              >
                {dayFmt.format(t)}
              </text>
            ))}

          {current && (
            <line
              x1={x(current.t)}
              x2={x(current.t)}
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
            p.status === 'amber' || p.status === 'red' || i === points.length - 1 || i === active ? (
              <circle
                key={p.t}
                cx={x(p.t)}
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
              x={x(last.t) + 10}
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

      {current && !compact && (
        <div
          className="pointer-events-none absolute z-10 w-44 surface-elevated px-3 py-2 text-xs"
          style={{
            left: x(current.t) + 184 > width ? Math.max(0, x(current.t) - 184) : x(current.t) + 12,
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

