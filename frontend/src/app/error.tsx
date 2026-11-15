'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="surface-card max-w-md space-y-4 p-8 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-status-caution" aria-hidden="true" />
        <div className="space-y-1.5">
          <h1 className="font-display text-lg font-bold text-blueberry">
            Something went wrong
          </h1>
          <p className="text-xs leading-relaxed text-stem">
            An unexpected rendering error occurred on this view. You can retry loading it or return to the main dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="tactile-press inline-flex items-center gap-1.5 rounded-sm bg-blueberry px-4 py-2 text-xs font-semibold text-plate hover:bg-berry"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Try again</span>
          </button>
          <Link
            href="/dashboard"
            className="tactile-press inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-4 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
