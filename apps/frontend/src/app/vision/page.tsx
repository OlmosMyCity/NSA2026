import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { VisionBiometricsPanel } from '@/features/vision/components/VisionBiometricsPanel';

export const metadata: Metadata = {
  title: 'Optical Biometrics · Orbvital',
  description: 'Contactless optical biometrics and crew fatigue monitoring.',
};

export default function VisionPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <HealthTabs />
        <VisionBiometricsPanel />
      </div>
    </AppLayout>
  );
}
