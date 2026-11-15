import type { Mission } from '@/features/missions/domain/types';
import { getCustomBlobUrl, getMissionSimConfig } from './missionSimulationConfig';

/**
 * Simulated 3D trajectory for each mission (served from public/mission-viewer/data/).
 * Adapts automatically to any mission by saved simulation config, ID, environment,
 * or name/description keywords (Earth LEO, Moon / Lunar Base, Cislunar, Mars Transit),
 * and supports custom uploaded trajectory JSONs and launch vehicles.
 */
const TRAJECTORIES_BY_ID: Record<string, string> = {
  'mission-01': 'data/artemis_ii.json',
  'mission-02': 'data/iss.json',
  'mission-03': 'data/lro.json',
  'mission-04': 'data/mars2020.json',
  'mission-05': 'data/europa_clipper.json',
  'mission-06': 'data/parker_solar_probe.json',
};

const DATA_FILES = {
  cislunar: 'data/artemis_ii.json',
  leo: 'data/iss.json',
  lunarBase: 'data/lro.json',
  mars: 'data/mars2020.json',
  jupiter: 'data/europa_clipper.json',
  venus: 'data/parker_solar_probe.json',
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

  if (/\b(jupiter|europa|jovian|outer system|saturn|clipper)\b/.test(text)) {
    return DATA_FILES.jupiter;
  }

  if (/\b(venus|parker|solar probe|mercury|inner system)\b/.test(text)) {
    return DATA_FILES.venus;
  }

  if (
    missionOrId.environment === 'MARS_BASE' ||
    /\b(mars|marte|perseverance|jezero|ares|phobos|deimos|interplanetary|tmi)\b/.test(text)
  ) {
    return DATA_FILES.mars;
  }

  if (
    missionOrId.environment === 'STATION' ||
    /\b(iss|expedition 72|leo|earth orbit|low earth|orbital station|órbita terrestre|tierra)\b/.test(text)
  ) {
    return DATA_FILES.leo;
  }

  if (
    missionOrId.environment === 'ROVER' ||
    missionOrId.environment === 'LUNAR_BASE' ||
    /\b(lro|reconnaissance orbiter|shackleton|rover|lunar base|50 km)\b/.test(text)
  ) {
    return DATA_FILES.lunarBase;
  }

  return DATA_FILES.cislunar;
}

export function resolveDefaultVehicleId(missionOrId: TrajectoryMissionInput): string {
  if (typeof missionOrId === 'string') return 'auto';
  const text = `${missionOrId.name} ${missionOrId.description ?? ''}`.toLowerCase();
  if (/\b(europa|clipper|jupiter)\b/.test(text)) return 'clipper';
  if (/\b(parker|solar probe|venus)\b/.test(text)) return 'parker';
  if (/\b(perseverance|mars 2020)\b/.test(text)) return 'mars2020';
  if (/\b(lro|reconnaissance orbiter)\b/.test(text)) return 'lro';
  switch (missionOrId.environment) {
    case 'STATION':
      return 'iss';
    case 'MARS_BASE':
      return 'mars2020';
    case 'ROVER':
      return 'rover';
    case 'LUNAR_BASE':
      return /\bartemis\b/i.test(missionOrId.name) ? 'orion' : 'lro';
    default:
      return 'orion';
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
