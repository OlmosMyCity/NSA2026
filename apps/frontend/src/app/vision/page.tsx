import type { Metadata } from 'next';
import { AppLayout } from '@/features/common/components/AppLayout';
import { HealthTabs } from '@/features/health/components/HealthTabs';
import { VisionBiometricsPanel } from '@/features/vision/components/VisionBiometricsPanel';

export const metadata: Metadata = {
  title: 'Vision AI Monitor · Orbvital',
  description: 'Contactless computer vision biometrics (rPPG, ONNX mood, PERCLOS fatigue) with 30s DB transaction sync.',
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
