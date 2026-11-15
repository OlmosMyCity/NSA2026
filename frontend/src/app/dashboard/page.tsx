import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { Skeleton } from '@/components/common/Skeleton';
import { HealthTabs } from '@/components/health/HealthTabs';
import { HealthDashboard } from '@/components/health/HealthDashboard';

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

