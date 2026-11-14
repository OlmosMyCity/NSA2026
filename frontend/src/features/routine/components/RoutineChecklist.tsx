'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Dumbbell,
  HeartPulse,
  Apple,
  Brain,
  Moon,
  Clock,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { RoutineTask, RoutineCategory } from '../domain/types';

interface RoutineChecklistProps {
  tasks: RoutineTask[];
  onToggleTask: (taskId: string) => void;
}

const CATEGORY_CONFIG: Record<
  RoutineCategory,
  { label: string; icon: React.ElementType }
> = {
  EXERCISE: {
    label: 'Physical Exercise & Resistance',
    icon: Dumbbell,
  },
  BIOMEDICAL: {
    label: 'Biomedical Telemetry',
    icon: HeartPulse,
  },
  NUTRITION: {
    label: 'Nutrition & Hydration',
    icon: Apple,
  },
  PSYCHOLOGICAL: {
    label: 'Behavioral Health Support',
    icon: Brain,
  },
  SLEEP_HYGIENE: {
    label: 'Circadian Sleep Hygiene',
    icon: Moon,
  },
};

export function RoutineChecklist({ tasks, onToggleTask }: RoutineChecklistProps) {
  const [filterCategory, setFilterCategory] = useState<RoutineCategory | 'ALL'>('ALL');

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalExerciseMins = tasks
    .filter((t) => t.category === 'EXERCISE' && t.completed)
    .reduce((acc, t) => acc + t.estimatedMinutes, 0);

  const filteredTasks =
    filterCategory === 'ALL'
      ? tasks
      : tasks.filter((t) => t.category === filterCategory);

  return (
    <div className="space-y-8">
      {/* Compliance summary — borderless typographic columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <span className="text-xs font-medium text-stem">Daily Compliance</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-blueberry tabular-nums">
              {progressPct}%
            </span>
            <span className="text-xs text-stem tabular-nums">
              ({completedCount} of {totalCount} tasks)
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden bg-surface-subtle">
            <div
              className={`h-full transition-all duration-panel ease-out-expo ${
                progressPct === 100 ? 'bg-status-nominal' : 'bg-blueberry'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-stem">Countermeasure Time</span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-blueberry tabular-nums">
              {totalExerciseMins}
            </span>
            <span className="text-xs text-stem">active minutes</span>
          </div>
          <p className="mt-2 text-xs text-stem">
            NASA HRP minimum target: 90 min/day in microgravity.
          </p>
        </div>

        <div>
          <span className="text-xs font-medium text-stem">Cycle Status</span>
          <div className="mt-2 flex items-center gap-2">
            {progressPct === 100 ? (
              <span className="text-sm font-bold text-status-nominal flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>Ready for rest</span>
              </span>
            ) : (
              <span className="text-sm font-bold text-berry flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>In progress</span>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-stem">
            Synchronized with Flight Surgeon console.
          </p>
        </div>
      </div>

      {/* Category filters — underline tabs */}
      <div className="ui-tabs">
        <button
          type="button"
          onClick={() => setFilterCategory('ALL')}
          className={`ui-tab text-xs font-semibold ${
            filterCategory === 'ALL' ? 'ui-tab-active' : ''
          }`}
        >
          All ({tasks.length})
        </button>

        {(Object.keys(CATEGORY_CONFIG) as RoutineCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = tasks.filter((t) => t.category === cat).length;
          const isActive = filterCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`ui-tab flex items-center gap-1.5 text-xs font-semibold ${
                isActive ? 'ui-tab-active' : ''
              }`}
            >
              <cfg.icon className="h-3.5 w-3.5" />
              <span>{cfg.label.split(' ')[0]}</span>
              <span className="opacity-70 tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Task list — flat borderless rows */}
      <div className="space-y-6">
        {filteredTasks.map((task) => {
          const catConfig = CATEGORY_CONFIG[task.category];
          const CategoryIcon = catConfig.icon;

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onToggleTask(task.id)}
              aria-pressed={task.completed}
              className={`tactile-press w-full text-left flex items-start gap-4 border-l-2 pl-4 py-1 transition-opacity ${
                task.completed
                  ? 'border-status-nominal opacity-70 hover:opacity-100'
                  : 'border-transparent hover:border-berry'
              }`}
            >
              <span className="mt-0.5 flex-shrink-0">
                {task.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-status-nominal" />
                ) : (
                  <Circle className="h-5 w-5 text-berry/50" />
                )}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-sm font-bold ${
                      task.completed ? 'line-through text-stem' : 'text-blueberry'
                    }`}
                  >
                    {task.title}
                  </span>

                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-berry">
                    <CategoryIcon className="h-3 w-3" />
                    <span>{catConfig.label}</span>
                  </span>

                  <span className="font-mono text-[11px] text-stem flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" />
                    <span>{task.estimatedMinutes} min</span>
                  </span>
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-stem">{task.description}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-stem">
                  <ShieldAlert className="h-3.5 w-3.5 text-berry" />
                  <span>HRP Mitigation: {task.hrpHazardTarget}</span>
                  {task.completed && task.completedAt && (
                    <span className="ml-auto font-mono font-medium text-status-nominal tabular-nums">
                      Completed today at{' '}
                      {new Date(task.completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
