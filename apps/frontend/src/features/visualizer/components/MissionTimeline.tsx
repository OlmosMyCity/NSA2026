'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { STATUS_THEME } from '@/features/health/domain/status-theme';
import {
  BASELINE_SHARE,
  createMissionScale,
  formatMET,
  type MissionPhase,
  type TimelineReading,
} from '../domain/missionClock';

const SURFACE = '#080f1e';
const BAND = ['rgba(255, 255, 255, 0.04)', 'rgba(56, 189, 248, 0.09)'];
const PHASE_NAME_EN: Record<string, string> = {
  Ascenso: 'Ascent',
  'Órbita de aparcamiento': 'Parking',
  'Tránsito translunar': 'Transit',
  'NRHO de Gateway': 'Gateway NRHO',
  'Órbita de descenso (HLS)': 'HLS Orbit',
  'Descenso propulsado (HLS)': 'Descent',
};

function phaseLabel(p: MissionPhase): string {
  return PHASE_NAME_EN[p.name] ?? p.name;
}

const dateFmt = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

interface MissionTimelineProps {
  phases: MissionPhase[];
  items: TimelineReading[];
  nowMet: number;
  /** Elapsed time currently displayed by the viewer. */
  cursorMet: number;
  selected: TimelineReading | null;
  onPick: (item: TimelineReading) => void;
}

export function MissionTimeline({
  phases,
  items,
  nowMet,
  cursorMet,
  selected,
  onPick,
}: MissionTimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<TimelineReading | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baselineSeconds = useMemo(
    () => Math.max(86400, -Math.min(0, ...items.map((i) => i.met))),
    [items]
  );
  const scale = useMemo(
    () => createMissionScale(phases, baselineSeconds),
    [phases, baselineSeconds]
  );

  const H = 112;
  const pad = 12;
  const iw = Math.max(0, width - pad * 2);
  const x = (met: number) => pad + scale.toFraction(met) * iw;
  const edgeAnchor = (cx: number) =>
    cx > width - 56 ? 'end' : cx < 56 ? 'start' : 'middle';
  const bandTop = 20;
  const bandH = 44;
  const dotY = bandTop + bandH / 2;

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!items.length || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault();
    const i = selected ? items.indexOf(selected) : items.length - 1;
    const next =
      items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    if (next && next.met <= nowMet) onPick(next);
  };

  const show = hover ?? null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="group"
          tabIndex={0}
          aria-label="Mission timeline with health readings. Use left and right arrow keys to step through."
          onKeyDown={onKey}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blueberry"
        >
          <defs>
            <pattern
              id="future"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="#38bdf8"
                strokeOpacity="0.22"
                strokeWidth="2"
              />
            </pattern>
          </defs>

          {/* Earth baseline */}
          <rect
            x={pad}
            y={bandTop}
            width={Math.max(0, BASELINE_SHARE * iw - 2)}
            height={bandH}
            rx={6}
            fill="rgba(255, 255, 255, 0.03)"
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth={1}
          />
          <text x={pad + 6} y={bandTop - 6} className="fill-stem text-[11px] font-medium">
            On Earth
          </text>

          {/* Mission phases */}
          {phases.map((p, i) => {
            const x0 = x(p.t_start);
            const w = x(p.t_end) - x0;
            const label = phaseLabel(p);
            return (
              <g key={p.id}>
                <rect
                  x={x0 + 1}
                  y={bandTop}
                  width={Math.max(0, w - 2)}
                  height={bandH}
                  rx={4}
                  fill={BAND[i % 2]}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth={1}
                >
                  <title>{p.name}</title>
                </rect>
                {w > label.length * 6.2 + 8 && (
                  <text x={x0 + 6} y={bandTop - 6} className="fill-stem text-[11px] font-medium">
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Planned future trajectory */}
          {phases.length > 0 && nowMet < phases.at(-1)!.t_end && (
            <rect
              x={x(nowMet)}
              y={bandTop}
              width={Math.max(0, pad + iw - x(nowMet))}
              height={bandH}
              fill="url(#future)"
              pointerEvents="none"
            />
          )}

          {/* Liftoff */}
          <line
            x1={x(0)}
            x2={x(0)}
            y1={bandTop - 2}
            y2={bandTop + bandH + 2}
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth={1}
          />
          <text x={x(0)} y={H - 26} textAnchor="middle" className="fill-stem text-[10px]">
            T+0
          </text>

          {/* Now */}
          <line
            x1={x(nowMet)}
            x2={x(nowMet)}
            y1={bandTop - 4}
            y2={bandTop + bandH + 4}
            stroke="#38bdf8"
            strokeWidth={2}
          />
          <text
            x={x(nowMet)}
            y={H - 26}
            textAnchor={edgeAnchor(x(nowMet))}
            className="fill-blueberry text-[11px] font-semibold"
          >
            Now
          </text>

          {/* Viewer cursor */}
          <line
            x1={x(cursorMet)}
            x2={x(cursorMet)}
            y1={bandTop}
            y2={bandTop + bandH}
            stroke="#e8702a"
            strokeWidth={2}
            pointerEvents="none"
          />

          {/* Readings */}
          {items.map((it) => {
            const cx = x(it.met);
            const isSel = selected?.reading.id === it.reading.id;
            return (
              <g
                key={it.reading.id}
                className="cursor-pointer"
                onPointerEnter={() => setHover(it)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onPick(it)}
              >
                <circle cx={cx} cy={dotY} r={12} fill="transparent" />
                <circle
                  cx={cx}
                  cy={dotY}
                  r={isSel ? 7 : 5}
                  fill={STATUS_THEME[it.status].color}
                  stroke={isSel ? '#38bdf8' : SURFACE}
                  strokeWidth={2}
                />
              </g>
            );
          })}

          <text
            x={x(cursorMet)}
            y={H - 8}
            textAnchor={edgeAnchor(x(cursorMet))}
            className="fill-berry font-mono text-[11px] tabular-nums"
          >
            {formatMET(cursorMet)}
          </text>
        </svg>
      )}

      {show && (
        <div
          className="surface-elevated pointer-events-none absolute z-10 w-48 border border-line px-3 py-2 text-xs"
          style={{
            left: Math.min(Math.max(0, x(show.met) - 96), Math.max(0, width - 192)),
            top: bandTop + bandH + 8,
          }}
        >
          <strong className="font-mono text-sm tabular-nums text-blueberry">
            {formatMET(show.met)}
          </strong>
          <div className="text-stem">{dateFmt.format(Date.parse(show.reading.takenAt))}</div>
          <div className="mt-1 font-medium text-blueberry">
            <span aria-hidden="true" style={{ color: STATUS_THEME[show.status].color }}>
              {STATUS_THEME[show.status].icon}
            </span>{' '}
            {show.status === 'red' ? 'Critical' : STATUS_THEME[show.status].label}
          </div>
        </div>
      )}
    </div>
  );
}
