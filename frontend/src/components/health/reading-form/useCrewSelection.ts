'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';

const NO_CREW: Astronaut[] = [];

/**
 * Tripulante para el que se registra la lectura.
 * - ADMIN: elige de toda la tripulación.
 * - USER: elige entre los compañeros de su misma misión (por defecto el suyo propio).
 */
export function useCrewSelection(initialAstronautId?: string) {
  const { user, isAdmin } = useAuth();
  const ownId = user?.astronautId ?? null;

  const crew = useAsync<Astronaut[]>(
    async () => {
      const res = await astronautService.list({ limit: 50 });
      if (isAdmin) return res.data;
      const myAstro = res.data.find((a) => a.id === ownId || a.userId === user?.id);
      if (!myAstro) return [];
      return res.data.filter((a) => a.missionId === myAstro.missionId);
    },
    [isAdmin, ownId, user?.id],
    'Unable to load the crew list.',
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const options = crew.data ?? NO_CREW;

  useEffect(() => {
    if (selectedId || !options.length) return;
    if (initialAstronautId && options.some((a) => a.id === initialAstronautId)) {
      setSelectedId(initialAstronautId);
      return;
    }
    if (ownId && options.some((a) => a.id === ownId)) {
      setSelectedId(ownId);
      return;
    }
    setSelectedId(options[0].id);
  }, [isAdmin, ownId, options, selectedId, initialAstronautId]);

  return {
    canChoose: isAdmin || options.length > 1,
    options,
    selectedId,
    selected: options.find((a) => a.id === selectedId),
    setSelectedId,
    isLoading: crew.isLoading,
    error: crew.error,
  };
}
