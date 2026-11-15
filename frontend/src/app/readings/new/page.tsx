import { Suspense } from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ReadingTabs } from '@/components/health/ReadingTabs';
import { ReadingFormWizard } from '@/components/health/ReadingFormWizard';

function ReadingPageContent({ searchParams }: { searchParams: { astronautId?: string } }) {
  return <ReadingFormWizard initialAstronautId={searchParams?.astronautId} />;
}

export default function NewReadingPage({
  searchParams,
}: {
  searchParams: { astronautId?: string };
}) {
  return (
    <AppLayout>
      <RouteGuard requireAuth={true}>
        <div className="py-4 sm:py-8">
          <Suspense
            fallback={
              <div className="surface-tinted mx-auto h-96 max-w-2xl animate-pulse rounded-lg" />
            }
          >
            <div className="space-y-6">
              <ReadingTabs />
              <ReadingPageContent searchParams={searchParams} />
            </div>
          </Suspense>
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

