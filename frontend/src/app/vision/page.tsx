import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { Skeleton } from '@/components/common/Skeleton';
import { HealthTabs } from '@/components/health/HealthTabs';
import { VisionBiometricsPanel } from '@/components/vision/VisionBiometricsPanel';

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
