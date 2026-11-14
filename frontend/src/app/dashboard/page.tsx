import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { HealthDashboard } from '@/features/health/components/HealthDashboard';

export const metadata: Metadata = {
  title: 'Health Dashboard · Orbvital',
  description: 'Interactive anatomical model displaying crew physiological status, indicators, and protocols.',
};

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <HealthTabs />
        <HealthDashboard />
      </div>
    </AppLayout>
  );
}

