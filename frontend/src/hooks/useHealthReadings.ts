'use client';

import { useMemo } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { healthService } from '../services/healthService';
import { toIndicatorReadings } from '../domain/health/api-adapter';
import { summarizeZones } from '../domain/health/summary';

/**
 * Lecturas de un astronauta y su resumen por zona. Sin `astronautId` no consulta nada.
 * Solo se muestran filas del astronauta actual: al cambiar de astronauta no quedan las del
 * anterior mientras carga, y una respuesta tardía de otro astronauta se descarta.
 */
export function useHealthReadings(astronautId: string | undefined) {
  const { data, isLoading, error, refetch } = useAsync(
    astronautId ? async () => ({ astronautId, rows: await healthService.listReadings(astronautId) }) : null,
    [astronautId],
    'Unable to load biomedical telemetry.',
  );

  const rows = useMemo(() => (data && data.astronautId === astronautId ? data.rows : []), [data, astronautId]);
  const readings = useMemo(() => rows.flatMap(toIndicatorReadings), [rows]);
  const zones = useMemo(() => summarizeZones(readings), [readings]);
  const latest = rows.at(-1) ?? null;

  return { rows, readings, zones, latest, isLoading, error, refetch };
}
