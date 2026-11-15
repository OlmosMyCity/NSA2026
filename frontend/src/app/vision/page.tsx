import type { Metadata } from 'next';
import { AppLayout } from '@/components/common/AppLayout';
import { HealthTabs } from '@/components/health/HealthTabs';
import { VisionBiometricsPanel } from '@/components/vision/VisionBiometricsPanel';

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
