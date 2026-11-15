'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';
import type { Astronaut } from '@/features/astronauts/domain/types';
import { FaceBiometricsManager } from '@/features/astronauts/components/FaceBiometricsManager';
import { AstronautFallbackAvatar } from '@/features/astronauts/components/AstronautFallbackAvatar';
import { SkeletonCard } from '@/features/common/components/Skeleton';
import {
  Edit2,
  Rocket,
  ScanFace,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';

export default function BiometricProfilePage() {
  const { user } = useAuth();
  const [missionCrew, setMissionCrew] = useState<Astronaut[]>([]);
  const [selectedAstroId, setSelectedAstroId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadProfileAndCrew = async () => {
      try {
        setIsLoading(true);
        const res = await astronautService.list({ limit: 50 });
        if (!active) return;

        const ownAstro = res.data.find(
          (a) => a.userId === user?.id || a.id === user?.astronautId
        );
        const isAdmin = user?.role === 'ADMIN';
        const sameMissionCrew =
          isAdmin || !ownAstro
            ? res.data
            : res.data.filter((a) => a.missionId === ownAstro.missionId);

        setMissionCrew(sameMissionCrew);
        if (ownAstro) {
          setSelectedAstroId(ownAstro.id);
        } else if (sameMissionCrew.length > 0) {
          setSelectedAstroId(sameMissionCrew[0].id);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfileAndCrew();
    return () => {
      active = false;
    };
  }, [user?.id, user?.astronautId, user?.role]);

  const activeAstronaut = missionCrew.find((a) => a.id === selectedAstroId) ?? null;
  const isOwnProfile =
    activeAstronaut &&
    (activeAstronaut.userId === user?.id || activeAstronaut.id === user?.astronautId);

  return (
    <AppLayout>
      <RouteGuard requiredRole={['ADMIN', 'USER']}>
        <div className="mx-auto max-w-4xl space-y-6 py-4 sm:py-6">
          <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-berry">
                <ScanFace className="h-3.5 w-3.5" />
                <span>Crew Identity &amp; Biometric Enrollment</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
                Profile &amp; Facial Biometrics
              </h1>
              <p className="mt-1 text-xs text-stem">
                Enroll facial reference images for yourself or your mission crewmates so Optical
                Vision AI automatically detects who is in front of the sensor.
              </p>
            </div>

            <Link
              href="/vision"
              className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-4 py-2 text-xs font-semibold text-plate hover:bg-berry self-start sm:self-auto"
            >
              <Video className="h-4 w-4" />
              <span>Open Live Vision AI</span>
            </Link>
          </header>

          {isLoading ? (
            <SkeletonCard />
          ) : !activeAstronaut ? (
            <div className="surface-card p-6 text-center text-xs text-stem">
              No active crew members found for your mission.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mission Crew Selector (Buddy Biometric Enrollment Rule) */}
              <div className="surface-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {activeAstronaut.photoUrl ? (
                      <div className="h-16 w-16 overflow-hidden rounded-sm border border-line flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeAstronaut.photoUrl}
                          alt={activeAstronaut.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <AstronautFallbackAvatar
                        name={activeAstronaut.name}
                        className="h-16 w-16 flex-shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-blueberry">
                          {activeAstronaut.name}
                        </h2>
                        {isOwnProfile ? (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] px-2 py-0.5 text-[10px] font-semibold text-status-nominal">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Your Account</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface-tinted px-2 py-0.5 text-[10px] font-semibold text-berry">
                            <Users className="h-3 w-3" />
                            <span>Mission Crewmate Assistance</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-berry">{activeAstronaut.role}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-stem">
                        <Rocket className="h-3.5 w-3.5 text-berry" />
                        <span>{activeAstronaut.mission?.name || 'Active Mission'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <label className="text-[11px] font-semibold text-stem">
                      Switch Mission Crew Member
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedAstroId}
                        onChange={(e) => setSelectedAstroId(e.target.value)}
                        className="twin-select w-auto min-w-[13rem] text-xs font-semibold"
                      >
                        {missionCrew.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.role})
                          </option>
                        ))}
                      </select>
                      <Link
                        href={`/astronauts/${activeAstronaut.id}/edit`}
                        className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
                        title="Edit full profile"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-berry" />
                        <span>Edit Details</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facial Biometrics Enrollment Manager */}
              <FaceBiometricsManager
                key={activeAstronaut.id}
                astronautId={activeAstronaut.id}
                astronautName={activeAstronaut.name}
              />
            </div>
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}
