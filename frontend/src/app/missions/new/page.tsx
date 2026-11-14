import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { MissionForm } from '@/features/missions/components/MissionForm';

export default function NewMissionPage() {
  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
        <div className="py-4 sm:py-8">
          <MissionForm isEditing={false} />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

