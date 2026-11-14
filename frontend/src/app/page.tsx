import { AppLayout } from '@/features/common/components/AppLayout';
import { HeroSection } from '@/features/landing/components/HeroSection';
import { HazardsSection } from '@/features/landing/components/HazardsSection';

export default function HomePage() {
  return (
    <AppLayout>
      <div className="space-y-8 pb-8">
        <HeroSection />
        <HazardsSection />
      </div>
    </AppLayout>
  );
}
