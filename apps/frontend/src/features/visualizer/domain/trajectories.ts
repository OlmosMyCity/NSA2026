/**
 * Trayectoria simulada de cada misión. Por ahora solo Artemis IV tiene una
 * (visor copiado de ArtemisIV-flight-dynamics, ver public/mission-viewer/SOURCE.md).
 * Cuando el backend guarde la trayectoria en la misión, esto se reemplaza por ese campo.
 */
const TRAJECTORIES: Record<string, string> = {
  'mission-01': '/mission-viewer/index.html?embed=1',
};

export function trajectoryUrl(missionId: string): string | null {
  return TRAJECTORIES[missionId] ?? null;
}
