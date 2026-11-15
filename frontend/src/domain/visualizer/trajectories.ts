/**
 * Mission trajectory and spacecraft resolver for the embedded 3D flight-dynamics viewer.
 * Selects preset or custom trajectory JSON data files and launch vehicle overrides based
 * on saved per-mission simulation config, mission ID, environment, and metadata keywords.
 *
 * @module domain/visualizer/trajectories
 */

import type { Mission } from '@/domain/missions/types';
import { getCustomBlobUrl, getMissionSimConfig } from './missionSimulationConfig';

/**
 * Simulated 3D trajectory catalog mapping (served from `public/mission-viewer/data/`).
 */
const TRAJECTORIES_BY_ID: Record<string, string> = {
  'mission-01': 'data/apollo_11.json',
  'mission-02': 'data/iss.json',
  'mission-03': 'data/apollo_13.json',
  'mission-04': 'data/apollo_17.json',
  'mission-05': 'data/artemis_ii.json',
  'mission-06': 'data/apollo_8.json',
};

const DATA_FILES = {
  apollo11: 'data/apollo_11.json',
  apollo13: 'data/apollo_13.json',
  apollo17: 'data/apollo_17.json',
  apollo8: 'data/apollo_8.json',
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

/** Resolves the default trajectory JSON asset path for a mission ID or metadata descriptor. */
export function resolveDefaultDataFile(missionOrId: TrajectoryMissionInput): string {
  if (typeof missionOrId === 'string') {
    return TRAJECTORIES_BY_ID[missionOrId] ?? DATA_FILES.cislunar;
  }

  if (TRAJECTORIES_BY_ID[missionOrId.id]) {
    return TRAJECTORIES_BY_ID[missionOrId.id];
  }

  const text = `${missionOrId.name} ${missionOrId.description ?? ''}`.toLowerCase();

  if (/\bapollo\s*11\b/.test(text)) return DATA_FILES.apollo11;
  if (/\bapollo\s*13\b/.test(text)) return DATA_FILES.apollo13;
  if (/\bapollo\s*17\b/.test(text)) return DATA_FILES.apollo17;
  if (/\bapollo\s*8\b/.test(text)) return DATA_FILES.apollo8;
  if (/\bartemis\b/.test(text)) return DATA_FILES.cislunar;

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

/** Resolves the default 3D vehicle identifier inferred from the mission environment and name. */
export function resolveDefaultVehicleId(missionOrId: TrajectoryMissionInput): string {
  if (typeof missionOrId === 'string') return 'auto';
  if (missionOrId.environment === 'ROVER') return 'rover';
  return 'auto';
}

/** Builds the embedded `/mission-viewer/index.html` iframe URL with `data` and optional `vehicle` params. */
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
