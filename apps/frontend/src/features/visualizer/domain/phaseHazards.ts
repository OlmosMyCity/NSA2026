import type { BodyZoneId } from '@/features/health/domain/types';

/**
 * Zonas del cuerpo a vigilar en cada fase de la simulación de Artemis IV
 * (según los peligros del vuelo espacial de NASA HRP). Claves = `id` de fase de mission.json.
 */
export const PHASE_WATCH: Record<string, BodyZoneId[]> = {
  ascent: ['heart'],
  parking: ['heart', 'brain'],
  leo: ['bones', 'sleep', 'heart'],
  heo: ['blood', 'heart', 'brain'],
  transit: ['blood', 'brain', 'sleep'],
  outbound: ['blood', 'brain', 'sleep'],
  cruise: ['blood', 'bones', 'sleep'],
  flyby: ['blood', 'brain'],
  gravity_assist: ['heart', 'brain'],
  lunar_orbit: ['bones', 'sleep', 'brain'],
  nrho: ['bones', 'sleep', 'brain'],
  approach: ['heart', 'brain', 'sleep'],
  descent: ['heart', 'brain'],
  edl: ['heart', 'brain'],
  landing: ['heart', 'bones'],
  return: ['heart', 'blood', 'brain'],
  perihelion: ['blood', 'heart', 'brain'],
};
