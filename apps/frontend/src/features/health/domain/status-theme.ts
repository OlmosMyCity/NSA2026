import type { HealthStatus } from './types';

/**
 * Tokens visuales del semáforo clínico armonizados en HSL.
 * El color nunca va solo: siempre se acompaña de etiqueta e icono (WCAG 1.4.1).
 */
export const STATUS_THEME: Record<
  HealthStatus,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  green: {
    label: 'Nominal',
    icon: '✓',
    color: 'var(--status-nominal)',
    bg: 'var(--status-nominal-bg)',
    border: 'var(--status-nominal-border)',
  },
  amber: {
    label: 'Watch',
    icon: '!',
    color: 'var(--status-caution)',
    bg: 'var(--status-caution-bg)',
    border: 'var(--status-caution-border)',
  },
  red: {
    label: 'Critical — notify flight surgeon',
    icon: '✕',
    color: 'var(--status-critical)',
    bg: 'var(--status-critical-bg)',
    border: 'var(--status-critical-border)',
  },
  unknown: {
    label: 'No data',
    icon: '?',
    color: 'var(--color-stem)',
    bg: 'var(--bg-surface-tinted)',
    border: 'var(--border-subtle)',
  },
};
