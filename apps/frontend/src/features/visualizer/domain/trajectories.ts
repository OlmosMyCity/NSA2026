import type { Mission } from '@/features/missions/domain/types';

/**
 * Simulated 3D trajectory for each mission (served from public/mission-viewer/data/).
 * Adapts automatically to any mission by ID, environment, or name/description keywords
 * (Earth LEO, Moon / Lunar Base, Cislunar Artemis, Mars Transit).
 */
const TRAJECTORIES_BY_ID: Record<string, string> = {
  'mission-01': '/mission-viewer/index.html?embed=1&data=data/mission.json',
  'mission-02': '/mission-viewer/index.html?embed=1&data=data/mission_iss_leo.json',
  'mission-03': '/mission-viewer/index.html?embed=1&data=data/mission_lunar_base.json',
  'mission-04': '/mission-viewer/index.html?embed=1&data=data/mission_mars_transit.json',
};

const DATA_FILES = {
  cislunar: '/mission-viewer/index.html?embed=1&data=data/mission.json',
  leo: '/mission-viewer/index.html?embed=1&data=data/mission_iss_leo.json',
  lunarBase: '/mission-viewer/index.html?embed=1&data=data/mission_lunar_base.json',
  mars: '/mission-viewer/index.html?embed=1&data=data/mission_mars_transit.json',
} as const;

export type TrajectoryMissionInput =
  | string
  | Pick<Mission, 'id' | 'name' | 'environment' | 'description'>;

export function trajectoryUrl(missionOrId: TrajectoryMissionInput): string {
  if (typeof missionOrId === 'string') {
    return TRAJECTORIES_BY_ID[missionOrId] ?? DATA_FILES.cislunar;
  }

  if (TRAJECTORIES_BY_ID[missionOrId.id]) {
    return TRAJECTORIES_BY_ID[missionOrId.id];
  }

  const text = `${missionOrId.name} ${missionOrId.description ?? ''}`.toLowerCase();

  if (
    missionOrId.environment === 'MARS_BASE' ||
    /\b(mars|marte|ares|phobos|deimos|interplanetary|tmi)\b/.test(text)
  ) {
    return DATA_FILES.mars;
  }

  if (
    missionOrId.environment === 'STATION' ||
    /\b(iss|leo|earth orbit|low earth|orbital station|órbita terrestre|tierra)\b/.test(text)
  ) {
    return DATA_FILES.leo;
  }

  if (
    missionOrId.environment === 'ROVER' ||
    missionOrId.environment === 'LUNAR_BASE' ||
    /\b(shackleton|rover|lunar base|south pole|crater|polo sur)\b/.test(text)
  ) {
    return DATA_FILES.lunarBase;
  }

  return DATA_FILES.cislunar;
}
