'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/common/AppLayout';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { MissionHealthView } from '@/components/visualizer/MissionHealthView';

export default function MissionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <AppLayout>
      <RouteGuard>
        <div>
          {id && (
            <ErrorBoundary
              fallbackTitle="Mission trajectory view unavailable"
              fallbackDescription="A rendering error occurred in this mission simulation view. Retry or return to your dashboard."
            >
              <MissionHealthView missionId={id} />
            </ErrorBoundary>
          )}
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

