'use client';

import React from 'react';
import { Flame, Trophy, Sparkles } from 'lucide-react';
import { Badge } from '../domain/types';

interface StreakBannerProps {
  streakDays: number;
  badges: Badge[];
}

export function StreakBanner({ streakDays, badges }: StreakBannerProps) {
  const nextBadge = badges.find((b) => b.requiredStreak > streakDays);
  const daysRemaining = nextBadge ? nextBadge.requiredStreak - streakDays : 0;
  const progressPercent = nextBadge
    ? Math.min(100, Math.round((streakDays / nextBadge.requiredStreak) * 100))
    : 100;

  return (
    <div className="surface-card p-6 text-plate">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Flame className="h-7 w-7 text-berry shrink-0" />

          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-3xl font-extrabold tracking-tight tabular-nums">
                {streakDays}
              </span>
              <span className="text-sm font-semibold text-plate/90">
                {streakDays === 1 ? 'Active streak day' : 'Consecutive days'}
              </span>
            </div>
            <p className="mt-1 text-xs text-stem max-w-md">
              Telemetry discipline and microgravity countermeasures aligned with NASA HRP standards.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center min-w-[260px] md:max-w-xs">
          {nextBadge ? (
            <>
              <div className="flex items-center justify-between text-xs mb-2 gap-3">
                <span className="text-plate/80 flex items-center gap-1.5 truncate">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Next: <strong className="text-plate">{nextBadge.title}</strong>
                  </span>
                </span>
                <span className="font-mono font-semibold text-plate tabular-nums shrink-0">
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-plate/20">
                <div
                  className="h-full bg-plate transition-all duration-panel ease-out-expo rounded-pill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="mt-1.5 font-mono text-[11px] text-plate/70 text-right tabular-nums">
                {streakDays} / {nextBadge.requiredStreak} days required
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-plate font-medium text-xs">
              <Sparkles className="h-4 w-4" />
              <span>All mission badges unlocked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
