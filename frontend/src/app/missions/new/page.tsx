import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { MissionForm } from '@/components/missions/MissionForm';

export default function NewMissionPage() {
  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
        <div className="py-4 sm:py-8">
          <MissionForm />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

