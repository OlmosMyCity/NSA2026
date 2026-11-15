'use client';

import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { OperatorCrewRecord } from '@/components/operator/OperatorCrewRecord';

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
