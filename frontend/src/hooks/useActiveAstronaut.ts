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

        const isAdmin = user?.role === 'ADMIN';
        const ownAstro = res.data.find(
          (a) => a.userId === user?.id || a.id === user?.astronautId
        );
        setOwnAstronautId(ownAstro?.id ?? user?.astronautId);
        // Regla de negocio: cualquier miembro de la misión puede asistir/seleccionar a compañeros de su misma misión
        const visibleCrew =
          isAdmin || !ownAstro
            ? res.data
            : res.data.filter((a) => a.missionId === ownAstro.missionId);

        setCrew(visibleCrew);
        setSelectedId((prev) => {
          if (prev && visibleCrew.some((a) => a.id === prev)) return prev;
          if (requestedId && visibleCrew.some((a) => a.id === requestedId)) return requestedId;
          return ownAstro?.id ?? user?.astronautId ?? visibleCrew[0]?.id ?? DEMO_ASTRONAUT_ID;
        });
      } catch {
        if (!active) return;
        setOwnAstronautId(user?.astronautId);
        setSelectedId(user?.astronautId ?? DEMO_ASTRONAUT_ID);
      } finally {
        if (active) setIsResolving(false);
      }
    };

    resolve();
    return () => {
      active = false;
    };
  }, [authLoading, user?.id, user?.astronautId, user?.role, requestedId]);

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
    ownAstronautId,
    crew,
    activeAstronaut,
    missionEnvironment,
    missionName,
    isResolving,
  };
}
