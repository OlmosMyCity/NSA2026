import { AppLayout } from '@/components/common/AppLayout';
import { HeroSection } from '@/components/landing/HeroSection';

export default function HomePage() {
  return (
    <AppLayout>
      <div className="pb-8">
        <HeroSection />
      </div>
    </AppLayout>
  );
}
