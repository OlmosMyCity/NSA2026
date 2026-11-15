import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 text-xs font-semibold">
              <Link
                href="/readings/new"
                className="tactile-press inline-flex items-center gap-1.5 text-stem hover:text-blueberry"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Switch to Manual Vital Entry</span>
              </Link>
              <Link
                href="/dashboard"
                className="tactile-press inline-flex items-center gap-1.5 text-plate hover:text-yogurt"
              >
                <span>Inspect 3D Digital Twin</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <VisionBiometricsPanel />
          </div>
        </Suspense>
      </RouteGuard>
    </AppLayout>
  );
}
