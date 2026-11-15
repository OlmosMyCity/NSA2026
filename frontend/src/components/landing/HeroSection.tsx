'use client';

import Link from 'next/link';
import { ArrowRight, Gauge, LogIn, Radar, Rocket, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function HeroSection() {
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';

  return (
    <section className="pt-8 pb-6 sm:pt-14 sm:pb-10">
      {/* Clean asymmetric industrial-editorial hero over raw web1.jpg */}
      <div className="flex min-h-[460px] sm:min-h-[520px] items-end border-b border-line pb-10">
        <div className="max-w-2xl space-y-5">
          <h1 className="font-display text-display font-extrabold tracking-tight text-plate leading-[1.02]">
            To deep space and back, safely.
          </h1>

          <p className="text-base sm:text-lg text-yogurt leading-relaxed max-w-lg">
            Crewed spaceflight vitals, physiological monitoring, and flight surgeon link.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!user ? (
              <>
                <Link
                  href="/login"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm bg-plate px-5 py-2.5 text-sm font-semibold text-ink-inverse hover:bg-yogurt"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Sign in</span>
                </Link>

                <Link
                  href="/register"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line-strong bg-canvas/75 px-5 py-2.5 text-sm font-semibold text-plate hover:bg-blueberry"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Register</span>
                </Link>
              </>
            ) : isOperator ? (
              <>
                <Link
                  href="/operator"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm bg-plate px-5 py-2.5 text-sm font-semibold text-ink-inverse hover:bg-yogurt"
                >
                  <Radar className="h-4 w-4" aria-hidden="true" />
                  <span>Oversight</span>
                </Link>

                <Link
                  href="/missions"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line-strong bg-canvas/75 px-5 py-2.5 text-sm font-semibold text-plate hover:bg-blueberry"
                >
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                  <span>Missions</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm bg-plate px-5 py-2.5 text-sm font-semibold text-ink-inverse hover:bg-yogurt"
                >
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  <span>My Health</span>
                </Link>

                <Link
                  href="/readings/new"
                  className="tactile-press inline-flex items-center gap-2 rounded-sm border border-line-strong bg-canvas/75 px-5 py-2.5 text-sm font-semibold text-plate hover:bg-blueberry"
                >
                  <span>Log Reading</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
