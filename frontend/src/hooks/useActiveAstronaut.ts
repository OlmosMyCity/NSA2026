'use client';

/**
 * @module hooks/useActiveAstronaut
 * Resolves the active astronaut context for `/dashboard` and `/trends`.
 */

import { useEffect, useState } from 'react';
import { ENV } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';

const DEMO_ASTRONAUT_ID = 'astro-01';

/**
 * Resolves the active `astronautId` for My Health (`/dashboard`) and `/trends`:
 * binds to the signed-in crew member's linked astronaut profile, or loads the crew
 * roster for `ADMIN` / demo users so any crew member can be inspected.
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
