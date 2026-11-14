'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { AccessDenied } from './AccessDenied';
import { Radio } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRole?: 'ADMIN' | 'USER';
}

export function RouteGuard({
  children,
  requireAuth = true,
  requiredRole,
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
    }
  }, [isLoading, requireAuth, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-tinted text-blueberry">
          <Radio className="h-5 w-5 text-berry animate-pulse" />
        </div>
        <span className="text-xs font-medium text-stem">
          Verifying crew session...
        </span>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

