'use client';

import React from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { FlightSurgeonConsole } from '@/components/admin/FlightSurgeonConsole';
import { OperatorAccessPanel } from '@/components/admin/OperatorAccessPanel';

export default function AdminPage() {
  return (
    <AppLayout>
      <RouteGuard requiredRole="ADMIN">
        <div className="py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
                Flight Surgeon Console
              </h1>
              <p className="mt-1.5 text-sm text-stem max-w-2xl">
                Crew biomedical triage and clinical directives.
              </p>
            </div>

            <span className="ui-badge text-status-nominal self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-status-nominal" aria-hidden="true" />
              <span>Live telemetry</span>
            </span>
          </div>

          <FlightSurgeonConsole />
          <OperatorAccessPanel />
        </div>
      </RouteGuard>
    </AppLayout>
  );
}
