import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { HealthTabs } from '@/components/health/HealthTabs';
import { TrendsView } from '@/components/health/TrendsView';

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

