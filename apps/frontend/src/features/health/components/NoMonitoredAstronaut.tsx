'use client';

import { UserX } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { EmptyState } from '@/features/common/components/EmptyState';

/** Estado vacío cuando no hay astronauta que mostrar en "My Health". */
export function NoMonitoredAstronaut() {
  const { isAdmin } = useAuth();
  return isAdmin ? (
    <EmptyState
      icon={UserX}
      title="Select a crew member"
      description="Open a crew member from the Flight Surgeon console to review their anatomical status and trends."
      actionHref="/admin"
      actionLabel="Go to console"
    />
  ) : (
    <EmptyState
      icon={UserX}
      title="No crew profile linked"
      description="Your account is not linked to a crew member yet. Ask the Flight Surgeon to add you to a mission's crew."
    />
  );
}
