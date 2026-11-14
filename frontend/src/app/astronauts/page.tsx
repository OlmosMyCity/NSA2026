import { AppLayout } from '@/features/common/components/AppLayout';
import { AstronautsList } from '@/features/astronauts/components/AstronautsList';

export default function AstronautsPage() {
  return (
    <AppLayout>
      <div className="py-6 sm:py-8">
        <AstronautsList />
      </div>
    </AppLayout>
  );
}

