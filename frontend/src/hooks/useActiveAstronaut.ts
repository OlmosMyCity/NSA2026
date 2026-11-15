'use client';

/**
 * @module health/hooks/useActiveAstronaut
 * Resolves the active astronaut context for `/dashboard` and `/trends`.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ENV } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';
import { missionService } from '@/services/missionService';
import type { MissionEnvironment } from '../services/digitalTwinService';

const DEMO_ASTRONAUT_ID = 'astro-01';

/**
 * Resuelve el astronautId activo para My Health (/dashboard) y /trends:
 * - Tripulante (USER): siempre el suyo; sin astronauta vinculado, `undefined` (la vista
 *   muestra un aviso). Nunca otro tripulante: el backend respondería 403.
 * - ADMIN: el de `?astronautId=` (enlace "Analyze trends" de la consola) o el primero del crew.
 * Además resuelve la misión asignada (`missionName`, `missionEnvironment`) para el gemelo digital.
 */
export function useActiveAstronaut() {
  const { user, isLoading: authLoading } = useAuth();
  const requestedId = useSearchParams().get('astronautId');
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
        const requested = user?.role === 'ADMIN' ? requestedId : null;
        setSelectedId(requested ?? user?.astronautId ?? DEMO_ASTRONAUT_ID);
        setIsResolving(false);
        return;
      }

      const isAdmin = user?.role === 'ADMIN';
      if (!isAdmin) {
        if (!active) return;
        setSelectedId(user?.astronautId);
        setIsResolving(false);
        return;
      }

      try {
        const res = await astronautService.list({ limit: 50 });
        if (!active) return;
        setCrew(res.data);
        setSelectedId((prev) => {
          if (prev && res.data.some((a) => a.id === prev)) return prev;
          if (requestedId && res.data.some((a) => a.id === requestedId)) return requestedId;
          return res.data[0]?.id;
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
  }, [authLoading, user?.astronautId, user?.role, requestedId]);

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
