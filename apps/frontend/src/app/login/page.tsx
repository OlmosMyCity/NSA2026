import { Suspense } from 'react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <AppLayout>
      <div className="py-8 sm:py-16">
        <Suspense
          fallback={
            <div className="surface-tinted mx-auto h-96 max-w-md animate-pulse rounded-lg" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </AppLayout>
  );
}

