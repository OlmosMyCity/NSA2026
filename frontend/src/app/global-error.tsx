'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6 text-slate-100 antialiased">
        <div className="max-w-md space-y-4 rounded-lg border border-slate-700 bg-slate-900/90 p-8 text-center shadow-xl">
          <h1 className="text-lg font-bold tracking-tight">Orbvital encountered an error</h1>
          <p className="text-xs leading-relaxed text-slate-300">
            A critical client error interrupted the application. Reloading this view will restore your session.
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-sm bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
            >
              Reload view
            </button>
            <a
              href="/missions"
              className="rounded-sm border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Go to Missions
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
