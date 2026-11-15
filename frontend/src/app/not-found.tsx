import Link from 'next/link';
import { AppLayout } from '@/components/common/AppLayout';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <AppLayout>
      <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
        <div className="surface-tinted px-8 py-10 w-full">
          <span className="font-mono text-4xl font-extrabold tabular-nums text-blueberry">
            404
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-blueberry">
            Route Not Found
          </h1>
          <p className="mt-2 text-sm text-stem leading-relaxed">
            The telemetry module or page you requested is not available in this mission path.
          </p>
          <Link
            href="/"
            className="tactile-press mt-6 inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2.5 text-xs font-semibold text-plate hover:bg-berry"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
