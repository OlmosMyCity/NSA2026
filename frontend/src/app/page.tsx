import { AppLayout } from '@/components/common/AppLayout';
import { HeroSection } from '@/components/landing/HeroSection';
import { HazardsSection } from '@/components/landing/HazardsSection';

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
