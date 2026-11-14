import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('artemis_auth_token')?.value;
  const role = cookieStore.get('artemis_auth_role')?.value;

  if (!token) {
    redirect('/login?returnUrl=%2Fadmin');
  }
  if (role && role !== 'ADMIN') {
    redirect('/?access_denied=true');
  }

  return <>{children}</>;
}
