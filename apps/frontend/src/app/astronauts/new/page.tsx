import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { AstronautForm } from '@/features/astronauts/components/AstronautForm';

export default function NewAstronautPage() {
  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
        <div className="py-6 sm:py-10">
          <AstronautForm />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

