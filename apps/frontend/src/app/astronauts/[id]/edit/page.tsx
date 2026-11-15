'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { AstronautForm } from '@/features/astronauts/components/AstronautForm';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { SkeletonCard } from '@/features/common/components/Skeleton';
import { useAsync } from '@/features/common/hooks/useAsync';
import { AlertCircle } from 'lucide-react';

export default function EditAstronautPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: astronaut, isLoading, error } = useAsync(() => astronautService.getById(id), [id], 'Failed to load astronaut.');

  return (
    <AppLayout>
      <RouteGuard requiredRole={['ADMIN', 'USER']}>
        <div className="py-6 sm:py-10">
          {isLoading ? (
            <div className="mx-auto max-w-2xl">
              <SkeletonCard />
            </div>
          ) : error || !astronaut ? (
            <div className="surface-card mx-auto max-w-md border-[var(--status-critical-border)] p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-status-critical" />
              <h2 className="mt-3 text-lg font-bold text-blueberry">Crew member unavailable</h2>
              <p className="mt-1 text-xs text-stem">
                {error || 'The requested astronaut could not be found.'}
              </p>
              <Link
                href="/astronauts"
                className="tactile-press mt-5 inline-block rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry"
              >
                Back to Directory
              </Link>
            </div>
          ) : (
            <AstronautForm initialData={astronaut} />
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

