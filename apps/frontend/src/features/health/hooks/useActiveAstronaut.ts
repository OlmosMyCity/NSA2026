'use client';

import { useEffect, useState } from 'react';
import { ENV } from '@/features/common/config/env';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';
import type { Astronaut } from '@/features/astronauts/domain/types';

const DEMO_ASTRONAUT_ID = 'astro-01';

/**
 * Resuelve el astronautId activo para My Health (/dashboard) y /trends:
 * usa el astronauta vinculado del usuario si es tripulante o el primero del crew si es ADMIN/demo.
 */
export function useActiveAstronaut() {
  const { user, isLoading: authLoading } = useAuth();
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const resolve = async () => {
      try {
        const res = await astronautService.list({ limit: 50 });
        if (!active) return;

        const isAdmin = user?.role === 'ADMIN';
        const ownAstro = res.data.find(
          (a) => a.userId === user?.id || a.id === user?.astronautId
        );
        // Regla de negocio: cualquier miembro de la misión puede asistir/seleccionar a compañeros de su misma misión
        const visibleCrew =
          isAdmin || !ownAstro
            ? res.data
            : res.data.filter((a) => a.missionId === ownAstro.missionId);

        setCrew(visibleCrew);
        setSelectedId((prev) => {
          if (prev && visibleCrew.some((a) => a.id === prev)) return prev;
          return ownAstro?.id ?? user?.astronautId ?? visibleCrew[0]?.id ?? DEMO_ASTRONAUT_ID;
        });
      } catch {
        if (!active) return;
        setSelectedId(user?.astronautId ?? DEMO_ASTRONAUT_ID);
      } finally {
        if (active) setIsResolving(false);
      }
    };

    resolve();
    return () => {
      active = false;
    };
  }, [authLoading, user?.id, user?.astronautId, user?.role]);

  return {
    astronautId: selectedId,
    setAstronautId: setSelectedId,
    crew,
    isResolving,
  };
}
