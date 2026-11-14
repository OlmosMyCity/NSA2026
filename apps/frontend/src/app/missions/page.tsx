import { AppLayout } from '@/features/common/components/AppLayout';
import { MissionsList } from '@/features/missions/components/MissionsList';

export default function MissionsPage() {
  return (
    <AppLayout>
      <MissionsList />
    </AppLayout>
  );
}

