'use client';

import React from 'react';
import { Rocket, Shield, Award, Flame, Lock, CheckCircle2 } from 'lucide-react';
import { Badge } from '../domain/types';

interface BadgeGridProps {
  badges: Badge[];
  streakDays: number;
}

const BADGE_ICONS: Record<string, React.ElementType> = {
  Rocket,
  Shield,
  Award,
  Flame,
};

export function BadgeGrid({ badges, streakDays }: BadgeGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-blueberry flex items-center gap-2">
          <Award className="h-4 w-4 text-berry" />
          <span>HRP Operational Discipline Badges</span>
        </h2>
        <span className="font-mono text-xs text-stem tabular-nums">
          {badges.filter((b) => b.unlockedAt).length} / {badges.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {badges.map((badge) => {
          const isUnlocked = Boolean(badge.unlockedAt);
          const IconComponent = BADGE_ICONS[badge.iconName] || Award;

          return (
            <div
              key={badge.id}
              className={`relative flex flex-col justify-between p-4 transition-opacity ${
                isUnlocked ? 'surface-card' : 'surface-tinted opacity-75'
              }`}
            >
              {isUnlocked && (
                <div className="absolute top-3.5 right-3.5 text-status-nominal">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center shrink-0 ${
                    isUnlocked ? 'text-blueberry' : 'text-stem'
                  }`}
                >
                  {isUnlocked ? (
                    <IconComponent className="h-5 w-5" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-blueberry">{badge.title}</h3>
                  <span className="font-mono text-[11px] text-stem tabular-nums">
                    {badge.requiredStreak} days required
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-stem line-clamp-2 leading-relaxed">
                {badge.description}
              </p>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] font-semibold">
                {isUnlocked ? (
                  <span className="text-status-nominal">Completed</span>
                ) : (
                  <span className="text-berry tabular-nums">
                    {Math.max(0, badge.requiredStreak - streakDays)} days remaining
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
