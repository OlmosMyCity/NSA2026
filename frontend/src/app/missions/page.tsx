import { AppLayout } from '@/components/common/AppLayout';
import { MissionTabs } from '@/components/common/MissionTabs';
import { MissionsList } from '@/components/missions/MissionsList';

export default function MissionsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <MissionTabs />
        <MissionsList />
      </div>
    </AppLayout>
  );
}

