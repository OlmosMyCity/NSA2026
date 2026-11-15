import { ENV } from '@/features/common/config/env';
import type { IndicatorId } from './types';

/**
 * Vigencia de los signos vivos. Regla pura: recibe `nowMs`, no lee el reloj.
 * Un dato vencido nunca se presenta como estado actual; el historial no se toca.
 */

/** Ventana durante la que una medición de signos vivos cuenta como estado actual. */
export const LIVE_VITALS_WINDOW_MS = ENV.FRESHNESS_WINDOW_MIN * 60_000;

/** Antelación del aviso previo al vencimiento. */
export const EXPIRY_WARNING_MS = 2 * 60_000;

/** Indicadores que cambian en minutos. Sueño, ánimo, glucosa y ejercicio no vencen con esta regla. */
export const LIVE_INDICATORS: readonly IndicatorId[] = [
  'heartRate',
  'systolic',
  'diastolic',
  'temperature',
  'spo2',
];

export const isLiveIndicator = (id: IndicatorId): boolean => LIVE_INDICATORS.includes(id);

export type FreshnessPhase = 'none' | 'fresh' | 'expiring' | 'expired';

export interface Freshness {
  phase: FreshnessPhase;
  /** Epoch ms en que vence; `null` si no hay lectura. */
  expiresAt: number | null;
  /** Milisegundos que quedan de vigencia (0 si venció o no hay lectura). */
  remainingMs: number;
  /** Fracción de vigencia restante, de 1 (recién medido) a 0 (vencido). */
  remainingRatio: number;
}

const NO_READING: Freshness = { phase: 'none', expiresAt: null, remainingMs: 0, remainingRatio: 0 };

export function evaluateFreshness(
  takenAt: string | null | undefined,
  nowMs: number,
  windowMs: number = LIVE_VITALS_WINDOW_MS
): Freshness {
  const takenMs = takenAt ? Date.parse(takenAt) : NaN;
  if (!Number.isFinite(takenMs)) return NO_READING;

  const expiresAt = takenMs + windowMs;
  // Una lectura con hora futura (reloj desfasado) no puede valer más que la ventana completa.
  const remainingMs = Math.min(windowMs, Math.max(0, expiresAt - nowMs));

  let phase: FreshnessPhase = 'fresh';
  if (remainingMs === 0) phase = 'expired';
  else if (remainingMs <= EXPIRY_WARNING_MS) phase = 'expiring';

  return { phase, expiresAt, remainingMs, remainingRatio: remainingMs / windowMs };
}

/** `m:ss` para la cuenta regresiva. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
