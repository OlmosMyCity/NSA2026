import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { Skeleton } from '@/features/common/components/Skeleton';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { VisionBiometricsPanel } from '@/features/vision/components/VisionBiometricsPanel';

export const metadata: Metadata = {
  title: 'Optical Biometrics · Orbvital',
  description: 'Contactless optical biometrics and crew fatigue monitoring.',
};

export default function VisionPage() {
  return (
    <AppLayout>
      {/* Igual que /dashboard y /trends: requiere sesión, y Suspense porque las pestañas y el
          tripulante activo leen ?astronautId (useSearchParams). */}
      <RouteGuard>
        <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
          <div className="space-y-6">
            <HealthTabs />
            <VisionBiometricsPanel />
          </div>
        </Suspense>
      </RouteGuard>
    </AppLayout>
  );
}
