import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { Skeleton } from '@/features/common/components/Skeleton';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { HealthDashboard } from '@/features/health/components/HealthDashboard';

export const metadata: Metadata = {
  title: 'Health Dashboard · Orbvital',
  description: 'Interactive anatomical model displaying crew physiological status, indicators, and protocols.',
};

export default function DashboardPage() {
  return (
    <AppLayout>
      <RouteGuard>
        <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
          <div className="space-y-6">
            <HealthTabs />
            <HealthDashboard />
          </div>
        </Suspense>
      </RouteGuard>
    </AppLayout>
  );
}

