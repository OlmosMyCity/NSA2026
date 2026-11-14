'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { MissionHealthView } from '@/features/visualizer/components/MissionHealthView';

export default function MissionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <AppLayout>
      <RouteGuard>
        <div>{id && <MissionHealthView missionId={id} />}</div>
      </RouteGuard>
    </AppLayout>
  );
}

