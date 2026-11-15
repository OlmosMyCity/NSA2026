/**
 * Client-side daily countermeasure routine tracker backed by `localStorage`.
 * Manages daily HRP protocol tasks, consecutive completion streaks, and badge unlocks
 * per astronaut across calendar day rollovers.
 *
 * @module features/routine/services/routineService
 */

import { RoutineTask, Badge, AstronautRoutineState } from '../domain/types';

const INITIAL_BADGES: Badge[] = [
  {
    id: 'badge-1',
    title: 'Orion Pioneer',
    description: 'Completed 3 consecutive days of biomedical protocols and resistive exercise.',
    iconName: 'Rocket',
    requiredStreak: 3,
    unlockedAt: null,
  },
  {
    id: 'badge-2',
    title: 'HRP Resilient',
    description: '7 days of strict adherence to microgravity countermeasures.',
    iconName: 'Shield',
    requiredStreak: 7,
    unlockedAt: null,
  },
  {
    id: 'badge-3',
    title: 'Zero-G Mastery',
    description: '14 days maintaining muscle mass and optimal circadian rhythm.',
    iconName: 'Award',
    requiredStreak: 14,
    unlockedAt: null,
  },
  {
    id: 'badge-4',
    title: 'Artemis Lunar Veteran',
    description: '30 days of medical discipline along the cislunar transit to Gateway.',
    iconName: 'Flame',
    requiredStreak: 30,
    unlockedAt: null,
  },
];

const DEFAULT_DAILY_TASKS: Omit<RoutineTask, 'completed' | 'completedAt'>[] = [
  {
    id: 'task-ared-resistive',
    title: 'ARED Protocol: Strength Training',
    description: '60 min of loaded squats and deadlifts to mitigate bone mineral density loss.',
    category: 'EXERCISE',
    estimatedMinutes: 60,
    hrpHazardTarget: 'Altered Gravity Fields (Atrophy & Osteopenia)',
  },
  {
    id: 'task-t2-cardio',
    title: 'T2 Treadmill / CEVIS Cycle: Aerobic Cardio',
    description: '30 min at 75–80% max heart rate to preserve cardiac output.',
    category: 'EXERCISE',
    estimatedMinutes: 30,
    hrpHazardTarget: 'Cardiovascular Deconditioning',
  },
  {
    id: 'task-biopulse-reading',
    title: 'Orbvital Morning Check (7 Indicators)',
    description: 'Log HR, BP, glucose, SpO2, temperature, sleep duration, and mood.',
    category: 'BIOMEDICAL',
    estimatedMinutes: 10,
    hrpHazardTarget: 'Comprehensive Medical Telemetry Monitoring',
  },
  {
    id: 'task-dosimetry-check',
    title: 'CPD Active Dosimeter Inspection',
    description: 'Verify cumulative cislunar radiation dose in mSv.',
    category: 'BIOMEDICAL',
    estimatedMinutes: 5,
    hrpHazardTarget: 'Deep Space Radiation',
  },
  {
    id: 'task-hydration-electrolytes',
    title: 'Hydration & Potassium Citrate (2.5 L)',
    description: 'Consume 2.5 L of water enriched with potassium and calcium citrate for plasma volume & renal stone prevention.',
    category: 'NUTRITION',
    estimatedMinutes: 15,
    hrpHazardTarget: 'Renal Lithiasis & Microgravity Dehydration',
  },
  {
    id: 'task-nutrition-ration',
    title: 'Space Ration, Glycemic & Vit-D Protocol',
    description: '20 min balanced ration intake with 2000 IU Vitamin D3 & calcium synergy to stabilize glucose and bone remodeling.',
    category: 'NUTRITION',
    estimatedMinutes: 20,
    hrpHazardTarget: 'Hostile Closed Environment (Metabolic & Bone Synergy)',
  },
  {
    id: 'task-mood-debrief',
    title: 'Behavioral Log & Decompression',
    description: '15 min of stress logging, ground support check-in, or binaural audio.',
    category: 'PSYCHOLOGICAL',
    estimatedMinutes: 15,
    hrpHazardTarget: 'Extreme Isolation & Confinement',
  },
  {
    id: 'task-circadian-light',
    title: 'Orion Circadian Spectrum Shift',
    description: 'Dim to low-wavelength amber lighting 2 hours before sleep window.',
    category: 'SLEEP_HYGIENE',
    estimatedMinutes: 5,
    hrpHazardTarget: 'Circadian Rhythm Disruption',
  },
];

class RoutineService {
  private getStorageKey(astronautId: string): string {
    return `artemis_routine_${astronautId}`;
  }

  /**
   * Loads today's routine state for an astronaut, refreshing the daily task list
   * on date rollover and resetting the streak if yesterday's checklist went unfinished.
   */
  getRoutineState(astronautId: string): AstronautRoutineState {
    const today = new Date().toISOString().split('T')[0];
    const key = this.getStorageKey(astronautId);

    if (typeof window === 'undefined') {
      return this.buildInitialState(astronautId, today);
    }

    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        const initial = this.buildInitialState(astronautId, today);
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }

      const parsed: AstronautRoutineState = JSON.parse(stored);

      // Roll over daily tasks on date change while preserving an active streak
      if (parsed.date !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let newStreak = parsed.streakDays;

        // Reset streak if yesterday was not completed or more than one day elapsed
        if (parsed.lastCompletedDate !== yesterday && parsed.lastCompletedDate !== today) {
          newStreak = 0;
        }

        const refreshed: AstronautRoutineState = {
          astronautId,
          date: today,
          tasks: DEFAULT_DAILY_TASKS.map((t) => ({ ...t, completed: false, completedAt: null })),
          streakDays: newStreak,
          lastCompletedDate: parsed.lastCompletedDate,
          badges: parsed.badges || INITIAL_BADGES,
        };

        localStorage.setItem(key, JSON.stringify(refreshed));
        return refreshed;
      }

      const existingIds = new Set(parsed.tasks.map((t) => t.id));
      const missingTasks = DEFAULT_DAILY_TASKS.filter((t) => !existingIds.has(t.id)).map((t) => ({
        ...t,
        completed: false,
        completedAt: null,
      }));
      if (missingTasks.length > 0) {
        const merged = { ...parsed, tasks: [...parsed.tasks, ...missingTasks] };
        localStorage.setItem(key, JSON.stringify(merged));
        return merged;
      }

      return parsed;
    } catch {
      return this.buildInitialState(astronautId, today);
    }
  }

  /** Toggles a daily task, updates the streak when all tasks are complete, and unlocks earned badges. */
  toggleTask(astronautId: string, taskId: string): AstronautRoutineState {
    return this.persistTaskCompletion(astronautId, taskId);
  }

  /** Explicitly sets completion state for a daily countermeasure task. */
  setTaskCompleted(astronautId: string, taskId: string, completed: boolean): AstronautRoutineState {
    return this.persistTaskCompletion(astronautId, taskId, completed);
  }

  private persistTaskCompletion(
    astronautId: string,
    taskId: string,
    forceCompleted?: boolean
  ): AstronautRoutineState {
    const current = this.getRoutineState(astronautId);
    const updatedTasks = current.tasks.map((task) => {
      if (task.id === taskId) {
        const nextCompleted = forceCompleted ?? !task.completed;
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? task.completedAt ?? new Date().toISOString() : null,
        };
      }
      return task;
    });

    const allCompleted = updatedTasks.every((t) => t.completed);
    let streakDays = current.streakDays;
    let lastCompletedDate = current.lastCompletedDate;

    if (allCompleted && current.lastCompletedDate !== current.date) {
      streakDays += 1;
      lastCompletedDate = current.date;
    } else if (!allCompleted && current.lastCompletedDate === current.date) {
      streakDays = Math.max(0, streakDays - 1);
      lastCompletedDate = null;
    }

    // Unlock any newly earned streak badges
    const updatedBadges = (current.badges || INITIAL_BADGES).map((b) => {
      if (streakDays >= b.requiredStreak && !b.unlockedAt) {
        return { ...b, unlockedAt: new Date().toISOString() };
      }
      return b;
    });

    const newState: AstronautRoutineState = {
      ...current,
      tasks: updatedTasks,
      streakDays,
      lastCompletedDate,
      badges: updatedBadges,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.getStorageKey(astronautId), JSON.stringify(newState));
    }

    return newState;
  }

  private buildInitialState(astronautId: string, today: string): AstronautRoutineState {
    // Seed demo astronauts with an initial 4-day streak
    const initialStreak = 4;
    const badges = INITIAL_BADGES.map((b) => {
      if (initialStreak >= b.requiredStreak) {
        return { ...b, unlockedAt: new Date(Date.now() - 86400000).toISOString() };
      }
      return b;
    });

    return {
      astronautId,
      date: today,
      tasks: DEFAULT_DAILY_TASKS.map((t, idx) => ({
        ...t,
        completed: idx < 2, // Pre-complete the first 2 tasks
        completedAt: idx < 2 ? new Date().toISOString() : null,
      })),
      streakDays: initialStreak,
      lastCompletedDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      badges,
    };
  }
}

export const routineService = new RoutineService();
