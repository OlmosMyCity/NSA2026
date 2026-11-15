'use client';

import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { OperatorConsole } from '@/components/operator/OperatorConsole';

export default function OperatorPage() {
  return (
    <AppLayout>
      <RouteGuard requiredRole="OPERATOR">
        <div className="py-6 sm:py-8">
          <div className="mb-8 border-b border-line pb-6">
            <h1 className="text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">Crew Oversight</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-stem">
              Ground view of your crew: current status, location, readiness by destination and the time of
              their last health reading.
            </p>
          </div>

          <OperatorConsole />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}
