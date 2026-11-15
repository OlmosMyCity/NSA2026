'use client';

/**
 * @module health/hooks/useActiveAstronaut
 * Resolves the active astronaut context for `/dashboard`, `/trends`, and `/vision`.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';
import { missionService } from '@/services/missionService';
import type { MissionEnvironment } from '../services/digitalTwinService';

const DEMO_ASTRONAUT_ID = 'astro-01';

/**
 * Resuelve el astronautId activo para My Health (/dashboard), /trends y /vision:
 * - Tripulante (USER): su propio astronauta por defecto, con visibilidad de compañeros de su misma misión
 *   para asistencia en misión y reconocimiento facial en `/vision`.
 * - ADMIN: el de `?astronautId=` (enlace "Analyze trends" de la consola) o el primero del crew.
 * Además resuelve la misión asignada (`missionName`, `missionEnvironment`) para el gemelo digital.
 */
export function useActiveAstronaut() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const requestedId = useSearchParams().get('astronautId');
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [ownAstronautId, setOwnAstronautId] = useState<string | undefined>(undefined);
  const [activeAstronaut, setActiveAstronaut] = useState<Astronaut | null>(null);
  const [missionEnvironment, setMissionEnvironment] = useState<MissionEnvironment>('LUNAR_BASE');
  const [missionName, setMissionName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const resolve = async () => {
      try {
        const res = await astronautService.list({ limit: 50 });
        if (!active) return;

        const ownAstro = res.data.find(
          (a) => a.userId === user?.id || a.id === user?.astronautId
        );
        const resolvedOwnId = ownAstro?.id ?? user?.astronautId;
        setOwnAstronautId(resolvedOwnId);

        // Solo el Flight Surgeon (ADMIN) puede cambiar entre tripulantes; el resto solo consulta su propio perfil.
        const visibleCrew = isAdmin ? res.data : ownAstro ? [ownAstro] : [];

        setCrew(visibleCrew);
        setSelectedId((prev) => {
          if (isAdmin) {
            if (prev && visibleCrew.some((a) => a.id === prev)) return prev;
            if (requestedId && visibleCrew.some((a) => a.id === requestedId)) return requestedId;
            return resolvedOwnId ?? visibleCrew[0]?.id ?? DEMO_ASTRONAUT_ID;
          }
          return resolvedOwnId;
        });
      } catch {
        if (!active) return;
        setOwnAstronautId(user?.astronautId);
        setSelectedId(user?.astronautId ?? (isAdmin ? DEMO_ASTRONAUT_ID : undefined));
      } finally {
        if (active) setIsResolving(false);
      }
    };

    resolve();
    return () => {
      active = false;
    };
  }, [authLoading, isAdmin, user?.id, user?.astronautId, requestedId]);

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

  const guardedSetAstronautId = (id: string) => {
    if (isAdmin || id === ownAstronautId) {
      setSelectedId(id);
    }
  };

  return {
    astronautId: selectedId,
    setAstronautId: guardedSetAstronautId,
    ownAstronautId,
    crew,
    activeAstronaut,
    missionEnvironment,
    missionName,
    isAdmin,
    isResolving,
  };
}
