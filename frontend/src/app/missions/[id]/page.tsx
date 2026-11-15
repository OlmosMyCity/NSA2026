'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { MissionHealthView } from '@/components/visualizer/MissionHealthView';

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

