import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { AstronautForm } from '@/components/astronauts/AstronautForm';

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

