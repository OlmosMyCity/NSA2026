'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { MissionForm } from '@/components/missions/MissionForm';
import { missionService } from '@/services/missionService';
import { Mission } from '@/domain/missions/types';
import { SkeletonCard } from '@/components/common/Skeleton';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function EditMissionPage() {
  const params = useParams();
  const id = params?.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchMission = async () => {
      try {
        setIsLoading(true);
        const data = await missionService.getById(id);
        setMission(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load requested mission.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMission();
  }, [id]);

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
            <MissionForm initialData={mission} isEditing={true} />
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

