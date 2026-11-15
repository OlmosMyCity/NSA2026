export interface VehicleOption {
  id: string;
  label: string;
  category: string;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: 'auto', label: 'Auto-match by mission', category: 'Default' },
  { id: 'sls', label: 'SLS Block 1B + Orion', category: 'Cislunar / Deep Space' },
  { id: 'dragon', label: 'Falcon 9 + Crew Dragon', category: 'LEO / ISS' },
  { id: 'soyuz', label: 'Soyuz MS', category: 'LEO / ISS' },
  { id: 'iss', label: 'ISS Orbital Station', category: 'LEO Station' },
  { id: 'hls', label: 'Starship HLS', category: 'Lunar Descent' },
  { id: 'rover', label: 'Pressurized Lunar Rover', category: 'Lunar Surface' },
  { id: 'gateway', label: 'Lunar Gateway', category: 'NRHO Station' },
  { id: 'ares', label: 'Ares I Mars Transit', category: 'Mars Interplanetary' },
];

export interface TrajectoryPresetOption {
  id: string;
  label: string;
}

export const TRAJECTORY_PRESETS: TrajectoryPresetOption[] = [
  { id: 'auto', label: 'Auto-detect from mission environment' },
  { id: 'data/mission_iss_leo.json', label: 'Low Earth Orbit (ISS · 420 km)' },
  { id: 'data/mission.json', label: 'Cislunar Transfer & Gateway NRHO' },
  { id: 'data/mission_lunar_base.json', label: 'Lunar South Pole & Rover Traverse' },
  { id: 'data/mission_mars_transit.json', label: 'Mars Interplanetary Transit' },
  { id: 'data/mission_jupiter_europa.json', label: 'Jupiter / Europa Outer-System Cruise' },
  { id: 'data/mission_venus_flyby.json', label: 'Venus Inner-System Gravity Assist' },
];

export interface MissionSimulationConfig {
  vehicleId: string;
  trajectoryPreset: string;
  customTrajectoryJson?: string | null;
  customFileName?: string | null;
}

const STORAGE_KEY = 'orbvital_mission_sim_configs_v1';
const blobCache = new Map<string, { json: string; url: string }>();

function readStore(): Record<string, MissionSimulationConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MissionSimulationConfig>) : {};
  } catch {
    return {};
  }
}

export function getMissionSimConfig(missionId: string): MissionSimulationConfig | null {
  const store = readStore();
  return store[missionId] ?? null;
}

export function saveMissionSimConfig(missionId: string, config: MissionSimulationConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const store = readStore();
    store[missionId] = config;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function validateTrajectoryJson(text: string): void {
  const parsed = JSON.parse(text) as {
    schema_version?: number;
    phases?: unknown;
    samples?: unknown;
  };
  if (
    parsed.schema_version !== 1 ||
    !Array.isArray(parsed.phases) ||
    parsed.phases.length === 0 ||
    !parsed.samples
  ) {
    throw new Error(
      'Invalid trajectory JSON: requires schema_version: 1, phases array, and samples.',
    );
  }
}

export function getCustomBlobUrl(missionId: string, jsonText: string): string {
  const cached = blobCache.get(missionId);
  if (cached && cached.json === jsonText) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
  blobCache.set(missionId, { json: jsonText, url });
  return url;
}
