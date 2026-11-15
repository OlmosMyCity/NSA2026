/**
 * @module components/health/StatusBadge
 * Accessible clinical status badge pairing a semantic color dot with a text label (WCAG 1.4.1).
 */

import { STATUS_THEME } from '../../domain/health/status-theme';
import type { HealthStatus } from '../../domain/health/types';

/** Traffic-light status pill backed by `STATUS_THEME`; `compact` shortens `red` to `"Critical"`. */
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

