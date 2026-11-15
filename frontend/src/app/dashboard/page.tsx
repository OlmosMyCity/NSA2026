import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { HealthTabs } from '@/components/health/HealthTabs';
import { HealthDashboard } from '@/components/health/HealthDashboard';

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

