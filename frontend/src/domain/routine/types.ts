/**
 * Domain contracts for daily HRP spaceflight countermeasure checklists,
 * adherence streaks, and milestone badges.
 *
 * @module domain/routine/types
 */

export type RoutineCategory =
  | 'EXERCISE'
  | 'BIOMEDICAL'
  | 'NUTRITION'
  | 'PSYCHOLOGICAL'
  | 'SLEEP_HYGIENE';

export interface RoutineTask {
  id: string;
  title: string;
  description: string;
  category: RoutineCategory;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string | null;
  hrpHazardTarget: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt?: string | null;
  requiredStreak: number;
}

export interface AstronautRoutineState {
  astronautId: string;
  date: string; // YYYY-MM-DD
  tasks: RoutineTask[];
  streakDays: number;
  lastCompletedDate?: string | null;
  badges: Badge[];
}
