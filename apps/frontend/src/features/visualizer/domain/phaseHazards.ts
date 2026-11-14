import type { BodyZoneId } from '@/features/health/domain/types';

/**
 * Zonas del cuerpo a vigilar en cada fase de la simulación de Artemis IV
 * (según los peligros del vuelo espacial de NASA HRP). Claves = `id` de fase de mission.json.
 */
export const PHASE_WATCH: Record<string, BodyZoneId[]> = {
  ascent: ['heart'],
  parking: ['heart', 'brain'],
  transit: ['blood', 'brain', 'sleep'],
  nrho: ['bones', 'sleep', 'brain'],
  descent: ['heart', 'brain'],
  landing: ['heart', 'bones'],
};
