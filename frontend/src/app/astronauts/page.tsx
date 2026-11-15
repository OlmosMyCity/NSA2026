import { AppLayout } from '@/components/common/AppLayout';
import { MissionTabs } from '@/components/common/MissionTabs';
import { AstronautsList } from '@/components/astronauts/AstronautsList';

export default function AstronautsPage() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4 sm:py-6">
        <MissionTabs />
        <AstronautsList />
      </div>
    </AppLayout>
  );
}

