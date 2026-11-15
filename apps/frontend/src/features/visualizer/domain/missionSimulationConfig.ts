export interface VehicleOption {
  id: string;
  label: string;
  category: string;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: 'auto', label: 'Auto-match by mission', category: 'Default' },
  { id: 'apollo', label: 'Apollo Command/Service Module', category: 'Apollo Lunar' },
  { id: 'saturnv', label: 'Saturn V + Apollo CSM/LM', category: 'Apollo Launch' },
  { id: 'orion', label: 'Orion MPCV (Artemis II)', category: 'Cislunar / Deep Space' },
  { id: 'sls', label: 'SLS Block 1 + Orion', category: 'Cislunar / Deep Space' },
  { id: 'iss', label: 'ISS Orbital Station', category: 'LEO Station' },
  { id: 'dragon', label: 'Falcon 9 + Crew Dragon', category: 'LEO / ISS' },
  { id: 'soyuz', label: 'Soyuz MS', category: 'LEO / ISS' },
  { id: 'hls', label: 'Starship HLS', category: 'Lunar Descent' },
  { id: 'rover', label: 'Pressurized Lunar Rover', category: 'Lunar Surface' },
  { id: 'gateway', label: 'Lunar Gateway', category: 'NRHO Station' },
];

export interface TrajectoryPresetOption {
  id: string;
  label: string;
}

export const TRAJECTORY_PRESETS: TrajectoryPresetOption[] = [
  { id: 'auto', label: 'Auto-detect from mission environment' },
  { id: 'data/apollo_11.json', label: 'Apollo 11 · First Lunar Landing (NASA · 8.14 d)' },
  { id: 'data/iss.json', label: 'ISS Expedition 72 · LEO 415 km, 51.6° (NASA)' },
  { id: 'data/apollo_13.json', label: 'Apollo 13 · Free-Return Abort 254 km (NASA · 5.95 d)' },
  { id: 'data/apollo_17.json', label: 'Apollo 17 · Taurus-Littrow & LRV (NASA · 12.58 d)' },
  { id: 'data/artemis_ii.json', label: 'Artemis II · Crewed Lunar Flyby (NASA · 9.06 d)' },
  { id: 'data/apollo_8.json', label: 'Apollo 8 · First Crewed Lunar Orbit 111 km (NASA · 6.13 d)' },
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
