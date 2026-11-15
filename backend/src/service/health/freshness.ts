/**
 * Vigencia de los signos vivos (FC, presión, SpO₂, temperatura).
 * Regla pura: no conoce Express, Prisma ni la hora del sistema (recibe `now`).
 * La vigencia se calcula al leer; nunca se guarda.
 */

export const DEFAULT_FRESHNESS_WINDOW_MIN = 15;

export function resolveFreshnessWindowMs(raw: string | undefined = process.env.FRESHNESS_WINDOW_MIN): number {
  const minutes = Number(raw);
  const valid = Number.isFinite(minutes) && minutes > 0;
  return (valid ? minutes : DEFAULT_FRESHNESS_WINDOW_MIN) * 60_000;
}

export interface ReadingFreshness {
  /** `false` si no hay lectura o si ya pasó la ventana. */
  isFresh: boolean;
  /** Momento en que la lectura deja de ser vigente; `null` si no hay lectura. */
  expiresAt: Date | null;
}

export function evaluateFreshness(
  takenAt: Date | null | undefined,
  now: Date,
  windowMs: number = resolveFreshnessWindowMs()
): ReadingFreshness {
  if (!takenAt) return { isFresh: false, expiresAt: null };

  const expiresAt = new Date(takenAt.getTime() + windowMs);
  return { isFresh: now.getTime() < expiresAt.getTime(), expiresAt };
}
