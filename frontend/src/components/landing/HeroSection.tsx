'use client';

import Link from 'next/link';
import { ArrowRight, Gauge } from 'lucide-react';

const WORKSPACE_SECTIONS = [
  {
    href: '/dashboard',
    title: 'My Health',
    summary: 'Inspect 3D body status, simulate countermeasures & review vital trends.',
  },
  {
    href: '/readings/new',
    title: 'Log Reading',
    summary: 'Record vitals manually or capture a contactless optical scan.',
  },
  {
    href: '/routine',
    title: 'Daily Routine',
    summary: 'Execute prioritized HRP protocols, nutrition & circadian tasks.',
  },
  {
    href: '/visualizer',
    title: 'Missions & Orbit',
    summary: 'Track 3D NRHO trajectory, active crew & facial biometrics.',
  },
];

export function HeroSection() {
  return (
    <section className="pt-8 pb-6 sm:pt-14 sm:pb-10">
      {/* Asymmetric industrial-editorial hero over raw web1.jpg */}
      <div className="min-h-[460px] sm:min-h-[520px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-line pb-8">
        <div className="lg:col-span-7 space-y-5">
          <h1 className="font-display text-display font-extrabold tracking-tight text-plate leading-[1.02]">
            To deep space and back, safely.
          </h1>

          <p className="text-base sm:text-lg text-yogurt leading-relaxed max-w-lg">
            Crewed spaceflight vitals, 5 biomedical hazards, and flight surgeon link.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/readings/new"
              className="tactile-press inline-flex items-center gap-2 rounded-sm bg-plate px-5 py-2.5 text-sm font-semibold text-ink-inverse hover:bg-yogurt"
            >
              <span>Log Reading</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard"
              className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line-strong bg-canvas/75 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-plate hover:bg-blueberry"
            >
              <Gauge className="h-4 w-4" />
              <span>My Health</span>
            </Link>
          </div>
        </div>

        {/* Asymmetric right-aligned raw terminal telemetry ledger — no outer box */}
        <dl className="lg:col-span-5 space-y-3 font-mono text-xs">
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-stem uppercase tracking-wider">SITE</dt>
            <dd className="text-plate font-bold tabular-nums">SHACKLETON · 86.8°S</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-stem uppercase tracking-wider">GRAVITY</dt>
            <dd className="text-plate font-bold tabular-nums">0.166 g (1/6 EARTH)</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-stem uppercase tracking-wider">ORBIT_RES</dt>
            <dd className="text-plate font-bold tabular-nums">NRHO 9:2 · GATEWAY</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-stem uppercase tracking-wider">TELEMETRY</dt>
            <dd className="text-status-nominal font-bold tabular-nums">7 VITALS // LINKED</dd>
          </div>
        </dl>
      </div>

      {/* Quick-access operational entry strip — hairline divided */}
      <nav
        aria-label="Operational workspaces"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line border-b border-line"
      >
        {WORKSPACE_SECTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col justify-between gap-2 px-4 py-5 first:pl-0 last:pr-0 hover:bg-surface-tinted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-bold text-plate group-hover:text-yogurt">
                {item.title}
              </p>
              <ArrowRight
                className="h-3.5 w-3.5 text-stem transition-transform group-hover:translate-x-0.5 group-hover:text-plate"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs leading-relaxed text-stem">{item.summary}</p>
          </Link>
        ))}
      </nav>
    </section>
  );
}
