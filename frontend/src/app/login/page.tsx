import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/common/AppLayout';
import { LoginForm } from '@/components/auth/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  if (cookies().get('artemis_auth_token')?.value) {
    redirect('/');
  }

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
