'use client';

import React from 'react';

interface SolarDiskPickerProps {
  sourceLocation: string;
  onSelect: (stonyhurst: string) => void;
}

function parseStonyhurst(loc: string): { latDeg: number; lonDeg: number } {
  const m = loc.trim().toUpperCase().match(/^([NS])(\d{1,2})([EW])(\d{1,3})$/);
  if (!m) return { latDeg: 14, lonDeg: 42 };
  const latDeg = (m[1] === 'N' ? 1 : -1) * Math.min(85, Number(m[2]));
  const lonDeg = (m[3] === 'W' ? 1 : -1) * Math.min(85, Number(m[4]));
  return { latDeg, lonDeg };
}

export function SolarDiskPicker({ sourceLocation, onSelect }: SolarDiskPickerProps) {
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const r = 56;

  const { latDeg, lonDeg } = parseStonyhurst(sourceLocation);
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;

  // Orthographic projection onto solar disk: +lon (West) is to the right in solar observer view
  const markerX = cx + r * Math.cos(latRad) * Math.sin(lonRad);
  const markerY = cy - r * Math.sin(latRad);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * size;
    const clickY = ((e.clientY - rect.top) / rect.height) * size;

    const nx = (clickX - cx) / r;
    const ny = (cy - clickY) / r;
    const distSq = nx * nx + ny * ny;
    if (distSq > 1.0) return; // Outside solar disk

    const clickedLatRad = Math.asin(Math.max(-0.98, Math.min(0.98, ny)));
    const cosLat = Math.max(0.15, Math.cos(clickedLatRad));
    const clickedLonRad = Math.asin(Math.max(-0.98, Math.min(0.98, nx / cosLat)));

    const latVal = Math.round((Math.abs(clickedLatRad) * 180) / Math.PI);
    const lonVal = Math.round((Math.abs(clickedLonRad) * 180) / Math.PI);
    const ns = clickedLatRad >= 0 ? 'N' : 'S';
    const ew = clickedLonRad >= 0 ? 'W' : 'E';

    const formatted = `${ns}${String(latVal).padStart(2, '0')}${ew}${String(lonVal).padStart(2, '0')}`;
    onSelect(formatted);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[148px] w-[148px] cursor-crosshair select-none rounded-md border border-line bg-canvas"
        onClick={handleClick}
        role="img"
        aria-label="Interactive Solar Disk Click-to-Flare Picker"
      >
        <defs>
          <radialGradient id="solar-disk-grad" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.92" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Solar Corona Glow */}
        <circle cx={cx} cy={cy} r={r + 5} fill="rgba(245, 158, 11, 0.12)" />
        {/* Solar Photosphere */}
        <circle cx={cx} cy={cy} r={r} fill="url(#solar-disk-grad)" stroke="rgba(253, 230, 138, 0.45)" strokeWidth="1" />

        {/* Optimal Parker Spiral Connection Band (W30 - W75) */}
        <path
          d={`M ${cx + r * 0.48} ${cy - r * 0.87} A ${r} ${r} 0 0 1 ${cx + r * 0.48} ${cy + r * 0.87} L ${cx + r * 0.94} ${cy + r * 0.34} A ${r} ${r} 0 0 0 ${cx + r * 0.94} ${cy - r * 0.34} Z`}
          fill="rgba(56, 189, 248, 0.22)"
          stroke="rgba(56, 189, 248, 0.55)"
          strokeWidth="0.8"
          strokeDasharray="2 2"
        />

        {/* Stonyhurst Equator & Central Meridian */}
        <line x1={cx - r} x2={cx + r} y1={cy} y2={cy} stroke="rgba(15, 23, 42, 0.45)" strokeWidth="0.8" />
        <line x1={cx} x2={cx} y1={cy - r} y2={cy + r} stroke="rgba(15, 23, 42, 0.45)" strokeWidth="0.8" />

        {/* Labels */}
        <text x={cx} y={12} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">N</text>
        <text x={cx} y={size - 5} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">S</text>
        <text x={9} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">E</text>
        <text x={size - 9} y={cy + 3} textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace">W</text>

        {/* Active Flare Marker */}
        <circle cx={markerX} cy={markerY} r={7} fill="rgba(244, 63, 94, 0.35)" />
        <circle cx={markerX} cy={markerY} r={3.5} fill="#f43f5e" stroke="#ffffff" strokeWidth="1" />
      </svg>
      <span className="font-mono text-[10px] text-stem text-center">
        Click solar disk · <span className="text-berry">Parker zone (W)</span>
      </span>
    </div>
  );
}
