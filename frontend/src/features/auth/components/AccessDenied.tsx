'use client';

import Link from 'next/link';
import { ShieldAlert, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AccessDenied() {
  const { user } = useAuth();

  return (
    <div className="mx-auto my-12 flex max-w-md flex-col items-center justify-center surface-card p-8 text-center animate-materialize">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--status-critical-bg)] text-status-critical">
        <ShieldAlert className="h-6 w-6" />
      </div>

      <h1 className="mt-4 text-xl font-bold tracking-tight text-blueberry">
        Access Restricted (403)
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-stem">
        This section is available exclusively to flight medical personnel (
        <strong className="text-blueberry">ADMIN</strong>).
      </p>

      {user && (
        <div className="mt-5 w-full surface-tinted p-3.5 text-left text-xs space-y-1.5">
          <div className="flex justify-between text-stem">
            <span>Current account</span>
            <span className="font-semibold text-blueberry">{user.name}</span>
          </div>
          <div className="flex justify-between text-stem">
            <span>Assigned role</span>
            <span className="font-mono font-medium text-berry">{user.role}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center">
        <Link
          href="/"
          className="tactile-press inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2.5 text-xs font-semibold text-plate hover:bg-berry"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
