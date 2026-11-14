import { AppLayout } from '@/features/common/components/AppLayout';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

export default function RegisterPage() {
  return (
    <AppLayout>
      <div className="py-8 sm:py-16">
        <RegisterForm />
      </div>
    </AppLayout>
  );
}

