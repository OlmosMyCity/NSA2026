import { LucideIcon, SatelliteDish } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

export function EmptyState({
  icon: Icon = SatelliteDish,
  title,
  description,
  actionHref,
  actionLabel,
  onActionClick,
}: EmptyStateProps) {
  return (
    <div className="surface-tinted mx-auto flex max-w-lg flex-col items-center justify-center p-8 text-center my-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface text-blueberry shadow-sm">
        <Icon className="h-6 w-6 text-berry" />
      </div>
      <h3 className="mt-4 text-base font-bold text-blueberry">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stem max-w-sm">
        {description}
      </p>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="tactile-press mt-5 inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry"
        >
          {actionLabel}
        </Link>
      )}

      {actionLabel && onActionClick && !actionHref && (
        <button
          type="button"
          onClick={onActionClick}
          className="tactile-press mt-5 inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

