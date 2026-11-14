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
      if (ENV.USE_MOCKS) {
        if (!active) return;
        setSelectedId(user?.astronautId ?? DEMO_ASTRONAUT_ID);
        setIsResolving(false);
        return;
      }

      const isAdmin = user?.role === 'ADMIN';
      if (user?.astronautId && !isAdmin) {
        if (!active) return;
        setSelectedId(user.astronautId);
        setIsResolving(false);
        return;
      }

      try {
        const res = await astronautService.list({ limit: 50 });
        if (!active) return;
        setCrew(res.data);
        setSelectedId((prev) => {
          if (prev && res.data.some((a) => a.id === prev)) return prev;
          return user?.astronautId ?? res.data[0]?.id;
        });
      } catch {
        if (!active) return;
        setSelectedId(user?.astronautId);
      } finally {
        if (active) setIsResolving(false);
      }
    };

    resolve();
    return () => {
      active = false;
    };
  }, [authLoading, user?.astronautId, user?.role]);

  return {
    astronautId: selectedId,
    setAstronautId: setSelectedId,
    crew,
    isResolving,
  };
}
