import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  if (cookies().get('artemis_auth_token')?.value) {
    redirect('/');
  }

  return (
    <AppLayout>
      <div className="py-8 sm:py-16">
        <RegisterForm />
      </div>
    </AppLayout>
  );
}
