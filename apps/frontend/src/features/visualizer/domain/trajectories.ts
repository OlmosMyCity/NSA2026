import type { Mission } from '@/features/missions/domain/types';
import { getCustomBlobUrl, getMissionSimConfig } from './missionSimulationConfig';

/**
 * Simulated 3D trajectory for each mission (served from public/mission-viewer/data/).
 * Adapts automatically to any mission by saved simulation config, ID, environment,
 * or name/description keywords (Earth LEO, Moon / Lunar Base, Cislunar, Mars Transit),
 * and supports custom uploaded trajectory JSONs and launch vehicles.
 */
const TRAJECTORIES_BY_ID: Record<string, string> = {
  'mission-01': 'data/mission.json',
  'mission-02': 'data/mission_iss_leo.json',
  'mission-03': 'data/mission_lunar_base.json',
  'mission-04': 'data/mission_mars_transit.json',
};

const DATA_FILES = {
  cislunar: 'data/mission.json',
  leo: 'data/mission_iss_leo.json',
  lunarBase: 'data/mission_lunar_base.json',
  mars: 'data/mission_mars_transit.json',
} as const;

export type TrajectoryMissionInput =
  | string
  | Pick<Mission, 'id' | 'name' | 'environment' | 'description'>;

export interface TrajectoryOverrides {
  vehicleId?: string;
  dataFile?: string;
}

export function resolveDefaultDataFile(missionOrId: TrajectoryMissionInput): string {
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
    /\b(shackleton|rover|lunar base)\b/.test(text)
  ) {
    return DATA_FILES.lunarBase;
  }

  return DATA_FILES.cislunar;
}

export function resolveDefaultVehicleId(missionOrId: TrajectoryMissionInput): string {
  if (typeof missionOrId === 'string') return 'auto';
  switch (missionOrId.environment) {
    case 'STATION':
      return 'dragon';
    case 'MARS_BASE':
      return 'ares';
    case 'ROVER':
      return 'rover';
    case 'LUNAR_BASE':
      return /\bartemis\b/i.test(missionOrId.name) ? 'auto' : 'hls';
    default:
      return 'auto';
  }
}

export function trajectoryUrl(
  missionOrId: TrajectoryMissionInput,
  overrides?: TrajectoryOverrides,
): string {
  const missionId = typeof missionOrId === 'string' ? missionOrId : missionOrId.id;
  const saved = getMissionSimConfig(missionId);

  let dataParam: string;
  if (overrides?.dataFile && overrides.dataFile !== 'auto') {
    dataParam = overrides.dataFile;
  } else if (saved?.customTrajectoryJson) {
    dataParam = getCustomBlobUrl(missionId, saved.customTrajectoryJson);
  } else if (saved?.trajectoryPreset && saved.trajectoryPreset !== 'auto') {
    dataParam = saved.trajectoryPreset;
  } else {
    dataParam = resolveDefaultDataFile(missionOrId);
  }

  const vehicleId =
    overrides?.vehicleId && overrides.vehicleId !== 'auto'
      ? overrides.vehicleId
      : saved?.vehicleId && saved.vehicleId !== 'auto'
        ? saved.vehicleId
        : resolveDefaultVehicleId(missionOrId);

  const qs = new URLSearchParams({ embed: '1', data: dataParam });
  if (vehicleId && vehicleId !== 'auto') {
    qs.set('vehicle', vehicleId);
  }
  return `/mission-viewer/index.html?${qs.toString()}`;
}
