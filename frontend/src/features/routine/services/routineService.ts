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
    title: 'Hydration & Electrolytes Protocol',
    description: 'Consume 2.5 L of water enriched with potassium and calcium citrate.',
    category: 'NUTRITION',
    estimatedMinutes: 15,
    hrpHazardTarget: 'Renal Lithiasis & Microgravity Dehydration',
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

      // Si cambió el día, renovar tareas preservando racha
      if (parsed.date !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let newStreak = parsed.streakDays;

        // Si ayer no completó todas las tareas, se resetea la racha (o si pasaron más días)
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

      return parsed;
    } catch {
      return this.buildInitialState(astronautId, today);
    }
  }

  toggleTask(astronautId: string, taskId: string): AstronautRoutineState {
    const current = this.getRoutineState(astronautId);
    const updatedTasks = current.tasks.map((task) => {
      if (task.id === taskId) {
        const nextCompleted = !task.completed;
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
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

    // Actualizar insignias alcanzadas
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
    // Para astronautas de muestra precargar 5 días de racha demostrativa
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
        completed: idx < 2, // 2 tareas completadas de inicio
        completedAt: idx < 2 ? new Date().toISOString() : null,
      })),
      streakDays: initialStreak,
      lastCompletedDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      badges,
    };
  }
}

export const routineService = new RoutineService();
