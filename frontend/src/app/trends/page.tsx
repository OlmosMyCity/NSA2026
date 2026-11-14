import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { TrendsView } from '@/features/health/components/TrendsView';

export const metadata: Metadata = {
  title: 'Trends · Orbvital',
  description: 'Historical evolution of each vital sign across nominal, watch, and critical bands.',
};

export default function TrendsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <HealthTabs />
        <TrendsView />
      </div>
    </AppLayout>
  );
}

