import type { BodyZoneId, HealthStatus } from '@/features/health/domain/types';
import { DESTINATIONS, type Destination, type OperatorDestinationReadiness, type ReadinessVerdict } from './types';

/**
 * Espejo de `apps/backend/src/application/health/readiness.ts`. La fuente de verdad es el
 * backend; esta copia solo alimenta el modo de datos simulados. Si cambia la matriz, cambia en ambos.
 */

type Condition = 'ALL_NOMINAL' | 'RECOVERY_WATCH' | 'VITAL_WATCH' | 'CRITICAL_FINDING';

const VITAL_ZONES: readonly BodyZoneId[] = ['heart', 'blood', 'brain'];

const DESTINATION_PROFILES: Record<Exclude<Destination, 'STORM_SHELTER'>, Record<Condition, ReadinessVerdict>> = {
  EVA: { ALL_NOMINAL: 'FIT', RECOVERY_WATCH: 'FIT_WITH_CAUTION', VITAL_WATCH: 'NOT_FIT', CRITICAL_FINDING: 'NOT_FIT' },
  ROVER: {
    ALL_NOMINAL: 'FIT',
    RECOVERY_WATCH: 'FIT_WITH_CAUTION',
    VITAL_WATCH: 'FIT_WITH_CAUTION',
    CRITICAL_FINDING: 'NOT_FIT',
  },
  HABITAT: { ALL_NOMINAL: 'FIT', RECOVERY_WATCH: 'FIT', VITAL_WATCH: 'FIT_WITH_CAUTION', CRITICAL_FINDING: 'NOT_FIT' },
  MODULE_TRANSFER: {
    ALL_NOMINAL: 'FIT',
    RECOVERY_WATCH: 'FIT',
    VITAL_WATCH: 'FIT',
    CRITICAL_FINDING: 'FIT_WITH_CAUTION',
  },
};

function classify(zoneStatus: Record<BodyZoneId, HealthStatus>): Condition {
  const statuses = Object.values(zoneStatus);
  if (statuses.includes('red')) return 'CRITICAL_FINDING';
  if (VITAL_ZONES.some((zone) => zoneStatus[zone] === 'amber')) return 'VITAL_WATCH';
  if (statuses.includes('amber')) return 'RECOVERY_WATCH';
  return 'ALL_NOMINAL';
}

export function evaluateOperatorReadiness(input: {
  zoneStatus: Record<BodyZoneId, HealthStatus>;
  isFresh: boolean;
  hasReadings: boolean;
}): OperatorDestinationReadiness[] {
  return DESTINATIONS.map((destination) => {
    if (destination === 'STORM_SHELTER') return { destination, verdict: 'FIT', note: 'PROTECTIVE_SHELTER' };

    const lacksVitalData = VITAL_ZONES.some((zone) => input.zoneStatus[zone] === 'unknown');
    if (!input.isFresh || lacksVitalData) {
      return { destination, verdict: 'NO_DATA', note: input.hasReadings ? 'READING_EXPIRED' : 'NO_READINGS' };
    }

    const verdict = DESTINATION_PROFILES[destination][classify(input.zoneStatus)];
    const note = verdict === 'NOT_FIT' ? 'MEDICAL_HOLD' : verdict === 'FIT_WITH_CAUTION' ? 'MEDICAL_CAUTION' : 'CLEARED';
    return { destination, verdict, note };
  });
}
