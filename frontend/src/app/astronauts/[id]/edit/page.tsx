'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { AstronautForm } from '@/features/astronauts/components/AstronautForm';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { Astronaut } from '@/features/astronauts/domain/types';
import { SkeletonCard } from '@/features/common/components/Skeleton';
import { AlertCircle } from 'lucide-react';

export default function EditAstronautPage() {
  const params = useParams();
  const id = params?.id as string;

  const [astronaut, setAstronaut] = useState<Astronaut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchAstronaut = async () => {
      try {
        setIsLoading(true);
        const data = await astronautService.getById(id);
        setAstronaut(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load astronaut.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAstronaut();
  }, [id]);

  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
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
            <AstronautForm initialData={astronaut} isEditing={true} />
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

