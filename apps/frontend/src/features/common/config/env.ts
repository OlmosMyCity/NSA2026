/**
 * Centralized runtime environment configuration for the frontend client.
 *
 * @module features/common/config/env
 */
export const ENV = {
  API_HOST: process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:4000/api',
  VISION_URL: process.env.NEXT_PUBLIC_VISION_URL || 'http://localhost:8000',
  USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === 'true',
  /** Minutos de vigencia de los signos vivos; debe coincidir con FRESHNESS_WINDOW_MIN del backend. */
  FRESHNESS_WINDOW_MIN: Number(process.env.NEXT_PUBLIC_FRESHNESS_WINDOW_MIN) > 0
    ? Number(process.env.NEXT_PUBLIC_FRESHNESS_WINDOW_MIN)
    : 15,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'artemis-assets',
} as const;

/**
 * Prevents CORS and mixed-content requests from production origins to `http://localhost:*`
 * when no public URL has been configured for an optional microservice.
 */
export function isReachableServiceUrl(url: string): boolean {
  if (!url) return false;
  if (typeof window === 'undefined') return true;
  try {
    const parsed = new URL(url);
    const isTargetLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isBrowserLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return !isTargetLocal || isBrowserLocal;
  } catch {
    return false;
  }
}

