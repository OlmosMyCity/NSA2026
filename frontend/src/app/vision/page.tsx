import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { Skeleton } from '@/components/common/Skeleton';
import { ReadingTabs } from '@/components/health/ReadingTabs';
import { VisionBiometricsPanel } from '@/components/vision/VisionBiometricsPanel';

export const metadata: Metadata = {
  title: 'Optical Biometrics · Orbvital',
  description: 'Contactless optical biometrics and crew fatigue monitoring.',
};

export default function VisionPage() {
  return (
    <AppLayout>
      {/* Igual que /dashboard y /readings/new: requiere sesión, y Suspense porque las pestañas y el
          tripulante activo leen ?astronautId (useSearchParams). */}
      <RouteGuard>
        <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
          <div className="space-y-6 py-4 sm:py-6">
            <ReadingTabs />
            <VisionBiometricsPanel />
          </div>
        </Suspense>
      </RouteGuard>
    </AppLayout>
  );
}
