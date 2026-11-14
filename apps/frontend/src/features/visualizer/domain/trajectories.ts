/**
 * Trayectoria simulada de cada misión (en public/mission-viewer/data/).
 */
const TRAJECTORIES: Record<string, string> = {
  'mission-01': '/mission-viewer/index.html?embed=1&data=data/mission.json',
  'mission-02': '/mission-viewer/index.html?embed=1&data=data/mission_iss_leo.json',
  'mission-03': '/mission-viewer/index.html?embed=1&data=data/mission_lunar_base.json',
  'mission-04': '/mission-viewer/index.html?embed=1&data=data/mission_mars_transit.json',
};

export function trajectoryUrl(missionId: string): string | null {
  return TRAJECTORIES[missionId] ?? null;
}
