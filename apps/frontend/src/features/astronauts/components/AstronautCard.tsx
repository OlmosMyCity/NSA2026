'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Astronaut } from '../domain/types';
import { AstronautFallbackAvatar } from './AstronautFallbackAvatar';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  HeartPulse,
  Edit2,
  Trash2,
  Rocket,
  ShieldCheck,
  ScanFace,
} from 'lucide-react';

interface AstronautCardProps {
  astronaut: Astronaut;
  onDeleteRequest: (astronaut: Astronaut) => void;
}

export function AstronautCard({ astronaut, onDeleteRequest }: AstronautCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canEditBiometrics = isAdmin || user?.role === 'USER';
  const faceSamplesCount = astronaut._count?.faceSamples ?? 0;

  return (
    <article className="surface-card group flex flex-col justify-between p-5 transition-colors hover:border-line-strong">
      <div>
        <div className="flex items-start gap-4">
          {astronaut.photoUrl ? (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-sm">
              <Image
                src={astronaut.photoUrl}
                alt={`Official portrait of ${astronaut.name}`}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <AstronautFallbackAvatar name={astronaut.name} className="h-16 w-16 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-bold text-blueberry group-hover:text-berry transition-colors">
                {astronaut.name}
              </h3>
              {astronaut.userId && (
                <span
                  title="Linked active account"
                  className="inline-flex items-center text-status-nominal"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </div>

            <p className="mt-0.5 text-xs font-medium text-berry truncate">
              {astronaut.role}
            </p>

            <span className="mt-1 inline-block font-mono text-[11px] tabular-nums text-stem">
              {astronaut.age} yrs
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Rocket className="h-3.5 w-3.5 flex-shrink-0 text-berry" aria-hidden="true" />
            <div className="truncate">
              <span className="text-stem">Mission: </span>
              <span className="font-semibold text-blueberry">
                {astronaut.mission?.name || 'Active Crewed Mission'}
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-mono text-[10px] font-semibold ${
              faceSamplesCount > 0
                ? 'border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] text-status-nominal'
                : 'border-line bg-surface-tinted text-stem'
            }`}
            title="Enrolled facial recognition samples"
          >
            <ScanFace className="h-3 w-3" />
            <span>{faceSamplesCount > 0 ? `Face ID (${faceSamplesCount})` : 'No Face ID'}</span>
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs">
        <Link
          href={`/readings/new?astronautId=${astronaut.id}`}
          className="tactile-press inline-flex items-center gap-1.5 font-semibold text-blueberry hover:text-berry"
        >
          <HeartPulse className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
          <span>Log Biometrics</span>
        </Link>

        {canEditBiometrics && (
          <div className="flex items-center gap-3">
            <Link
              href={`/astronauts/${astronaut.id}/edit`}
              className="tactile-press inline-flex items-center gap-1 text-stem hover:text-blueberry"
              title="Edit astronaut & facial biometrics"
              aria-label={`Edit profile and facial biometrics for ${astronaut.name}`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Biometrics</span>
            </Link>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onDeleteRequest(astronaut)}
                className="tactile-press text-stem hover:text-status-critical"
                title="Remove crew member"
                aria-label={`Remove ${astronaut.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
