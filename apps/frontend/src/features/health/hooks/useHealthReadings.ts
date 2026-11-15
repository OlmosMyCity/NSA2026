'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { healthService } from '../services/healthService';
import { toIndicatorReadings, type ApiHealthReading } from '../domain/api-adapter';
import { summarizeZones } from '../domain/summary';

export function useHealthReadings(astronautId: string | undefined) {
  const [rows, setRows] = useState<ApiHealthReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    if (!astronautId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setRows([]);
      setRows(await healthService.listReadings(astronautId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load biomedical telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, [astronautId]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const readings = useMemo(() => rows.flatMap(toIndicatorReadings), [rows]);
  const zones = useMemo(() => summarizeZones(readings), [readings]);
  const latest = rows.at(-1) ?? null;

  return { rows, readings, zones, latest, isLoading, error, refetch: fetchReadings };
}
