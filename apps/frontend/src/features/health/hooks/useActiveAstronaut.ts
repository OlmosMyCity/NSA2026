'use client';

/**
 * @module health/hooks/useActiveAstronaut
 * Resolves the active astronaut context for `/dashboard` and `/trends`.
 */

import { useEffect, useState } from 'react';
import { ENV } from '@/features/common/config/env';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';
import type { Astronaut } from '@/features/astronauts/domain/types';
import { missionService } from '@/features/missions/services/missionService';
import type { MissionEnvironment } from '../services/digitalTwinService';

const DEMO_ASTRONAUT_ID = 'astro-01';

/**
 * Resolves the active `astronautId` for My Health (`/dashboard`) and `/trends`:
 * binds to the signed-in crew member's linked astronaut profile, or loads the crew
 * roster for `ADMIN` / demo users so any crew member can be inspected, along with
 * the astronaut's assigned mission habitat (`missionEnvironment`).
 */
export function useActiveAstronaut() {
  const { user, isLoading: authLoading } = useAuth();
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [activeAstronaut, setActiveAstronaut] = useState<Astronaut | null>(null);
  const [missionEnvironment, setMissionEnvironment] = useState<MissionEnvironment>('LUNAR_BASE');
  const [missionName, setMissionName] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selectedId) {
      setActiveAstronaut(null);
      setMissionEnvironment('LUNAR_BASE');
      setMissionName(null);
      return;
    }

    let active = true;
    const resolveMissionContext = async () => {
      try {
        const matched = crew.find((a) => a.id === selectedId);
        const astro = matched ?? (await astronautService.getById(selectedId));
        if (!active) return;
        setActiveAstronaut(astro);
        setMissionName(astro.mission?.name ?? null);

        if (astro.missionId) {
          const mission = await missionService.getById(astro.missionId);
          if (!active) return;
          setMissionEnvironment(mission.environment as MissionEnvironment);
          setMissionName(mission.name);
        }
      } catch {
        // Keep current fallback habitat ('LUNAR_BASE') if profile or mission cannot be resolved.
      }
    };

    void resolveMissionContext();
    return () => {
      active = false;
    };
  }, [selectedId, crew]);

  return {
    astronautId: selectedId,
    setAstronautId: setSelectedId,
    crew,
    activeAstronaut,
    missionEnvironment,
    missionName,
    isResolving,
  };
}
