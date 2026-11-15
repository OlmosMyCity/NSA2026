import { AppLayout } from '@/components/common/AppLayout';
import { AstronautsList } from '@/components/astronauts/AstronautsList';

export default function AstronautsPage() {
  return (
    <AppLayout>
      <div className="py-6 sm:py-8">
        <AstronautsList />
      </div>
    </AppLayout>
  );
}

