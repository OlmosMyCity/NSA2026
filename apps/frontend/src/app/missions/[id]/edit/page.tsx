'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { MissionForm } from '@/features/missions/components/MissionForm';
import { missionService } from '@/features/missions/services/missionService';
import { SkeletonCard } from '@/features/common/components/Skeleton';
import { useAsync } from '@/features/common/hooks/useAsync';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function EditMissionPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: mission, isLoading, error } = useAsync(() => missionService.getById(id), [id], 'Failed to load requested mission.');

  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
        <div className="py-4 sm:py-8">
          {isLoading ? (
            <div className="mx-auto max-w-2xl">
              <SkeletonCard />
            </div>
          ) : error || !mission ? (
            <div className="surface-card mx-auto max-w-md p-6 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-status-critical" />
              <h2 className="mt-3 text-lg font-bold text-blueberry">Mission unavailable</h2>
              <p className="mt-1 text-xs text-stem">{error || 'The mission was not found.'}</p>
              <Link
                href="/missions"
                className="tactile-press mt-4 inline-block rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate"
              >
                Back to Missions
              </Link>
            </div>
          ) : (
            <MissionForm initialData={mission} />
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

