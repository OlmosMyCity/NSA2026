'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';

const NO_CREW: Astronaut[] = [];

/**
 * Tripulante para el que se registra la lectura.
 * - ADMIN: elige de la lista (por defecto `initialAstronautId` o el primero).
 * - USER: siempre el suyo; el backend rechaza lecturas para otros (403).
 */
export function useCrewSelection(initialAstronautId?: string) {
  const { user, isAdmin } = useAuth();
  const ownId = user?.astronautId ?? null;

  const crew = useAsync<Astronaut[]>(
    async () => {
      if (isAdmin) return (await astronautService.list({ limit: 50 })).data;
      return ownId ? [await astronautService.getById(ownId)] : [];
    },
    [isAdmin, ownId],
    'Unable to load the crew list.',
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const options = crew.data ?? NO_CREW;

  useEffect(() => {
    if (!isAdmin) {
      setSelectedId(ownId);
      return;
    }
    if (selectedId || !options.length) return;
    setSelectedId(options.some((a) => a.id === initialAstronautId) ? initialAstronautId! : options[0].id);
  }, [isAdmin, ownId, options, selectedId, initialAstronautId]);

  return {
    canChoose: isAdmin,
    options,
    selectedId,
    selected: options.find((a) => a.id === selectedId),
    setSelectedId,
    isLoading: crew.isLoading,
    error: crew.error,
  };
}
