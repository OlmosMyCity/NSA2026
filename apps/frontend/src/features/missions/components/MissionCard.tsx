'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mission, Environment, MissionStatus } from '../domain/types';
import { MissionFallbackPatch } from './MissionFallbackPatch';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  Rocket,
  Compass,
  Building2,
  Car,
  Globe2,
  Calendar,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface MissionCardProps {
  mission: Mission;
  onDeleteRequest: (mission: Mission) => void;
}

const ENVIRONMENT_CONFIG: Record<
  Environment,
  { label: string; icon: typeof Rocket }
> = {
  SPACECRAFT: { label: 'Spacecraft', icon: Rocket },
  STATION: { label: 'Orbital Station', icon: Building2 },
  ROVER: { label: 'Lunar Rover', icon: Car },
  LUNAR_BASE: { label: 'Lunar Base', icon: Compass },
  MARS_BASE: { label: 'Mars Base', icon: Globe2 },
};

const STATUS_CONFIG: Record<
  MissionStatus,
  { label: string; colorClass: string; dotClass: string }
> = {
  PLANNING: {
    label: 'Planning',
    colorClass: 'text-status-caution',
    dotClass: 'bg-status-caution',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    colorClass: 'text-status-nominal',
    dotClass: 'bg-status-nominal',
  },
  COMPLETED: {
    label: 'Completed',
    colorClass: 'text-stem',
    dotClass: 'bg-stem',
  },
};

export function MissionCard({ mission, onDeleteRequest }: MissionCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const envConfig = ENVIRONMENT_CONFIG[mission.environment] || ENVIRONMENT_CONFIG.LUNAR_BASE;
  const statusConfig = STATUS_CONFIG[mission.status] || STATUS_CONFIG.IN_PROGRESS;
  const EnvIcon = envConfig.icon;

  const formattedDate = new Date(mission.startDate).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className="surface-card group relative flex flex-col justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-4">
          {mission.patchUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-sm shrink-0">
              <Image
                src={mission.patchUrl}
                alt={`Official mission patch for ${mission.name}`}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <MissionFallbackPatch name={mission.name} className="h-16 w-16" />
          )}

          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stem">
              <EnvIcon className="h-3 w-3 text-berry" />
              <span>{envConfig.label}</span>
            </span>

            <span className={`ui-badge ${statusConfig.colorClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} aria-hidden="true" />
              <span>{statusConfig.label}</span>
            </span>
          </div>
        </div>

        <div className="mt-5">
          <Link href={`/missions/${mission.id}`} className="group/title block">
            <h3 className="text-base font-bold text-blueberry group-hover/title:text-berry transition-colors flex items-center justify-between gap-2">
              <span>{mission.name}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity text-berry" />
            </h3>
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-stem line-clamp-3">
            {mission.description}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-stem font-mono text-[11px] tabular-nums">
          <Calendar className="h-3.5 w-3.5 text-berry" />
          <span>Start: {formattedDate}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/missions/${mission.id}`}
            className="tactile-press flex items-center gap-1 text-[11px] font-semibold text-blueberry hover:text-berry"
            title="View mission details and synchronized telemetry"
          >
            <span>Details</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          {isAdmin && (
            <>
              <Link
                href={`/missions/${mission.id}/edit`}
                className="tactile-press text-stem hover:text-blueberry"
                title="Edit mission"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => onDeleteRequest(mission)}
                className="tactile-press text-stem hover:text-status-critical"
                title="Delete mission"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
