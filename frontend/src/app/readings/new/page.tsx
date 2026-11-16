import { Suspense } from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ReadingFormWizard } from '@/components/health/ReadingFormWizard';

function ReadingPageContent({
  searchParams,
}: {
  searchParams: { astronautId?: string; step?: string };
}) {
  return (
    <ReadingFormWizard
      initialAstronautId={searchParams?.astronautId}
      initialStep={searchParams?.step === 'review' ? 1 : 0}
    />
  );
}

export default function NewReadingPage({
  searchParams,
}: {
  searchParams: { astronautId?: string; step?: string };
}) {
  return (
    <AppLayout>
      <RouteGuard requireAuth={true}>
        <div className="space-y-6">
          <Suspense
            fallback={
              <div className="surface-tinted h-96 w-full animate-pulse rounded-lg" />
            }
          >
            <ReadingPageContent searchParams={searchParams} />
          </Suspense>
        </div>
      </RouteGuard>
    </AppLayout>
  );
}

