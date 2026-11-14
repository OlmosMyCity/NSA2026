import { STATUS_THEME } from '../domain/status-theme';
import type { HealthStatus } from '../domain/types';

export function StatusBadge({
  status,
  compact = false,
}: {
  status: HealthStatus;
  compact?: boolean;
}) {
  const t = STATUS_THEME[status];
  return (
    <span className="ui-badge" style={{ color: t.color }}>
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: t.color }}
        aria-hidden="true"
      />
      <span>{compact && status === 'red' ? 'Critical' : t.label}</span>
    </span>
  );
}

