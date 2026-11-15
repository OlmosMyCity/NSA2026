import type { BodyZoneId } from '@/features/health/domain/types';

/**
 * Primary physiological body zones monitored during each mission simulation phase
 * (mapped to NASA HRP spaceflight hazards). Keys match phase `id` entries in mission JSONs.
 *
 * @module features/visualizer/domain/phaseHazards
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
