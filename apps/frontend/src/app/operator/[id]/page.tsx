'use client';

import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { OperatorCrewRecord } from '@/features/operator/components/OperatorCrewRecord';

export default function OperatorCrewRecordPage({ params }: { params: { id: string } }) {
  return (
    <AppLayout>
      <RouteGuard requiredRole="OPERATOR">
        <div className="py-6 sm:py-8">
          <OperatorCrewRecord astronautId={params.id} />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}
