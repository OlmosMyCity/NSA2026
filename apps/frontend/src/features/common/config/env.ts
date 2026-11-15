/**
 * Configuración centralizada de variables de entorno para el cliente frontend.
 */
export const ENV = {
  API_HOST: process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:4000/api',
  VISION_URL: process.env.NEXT_PUBLIC_VISION_URL || 'http://localhost:8000',
  SIGNAL_NOISE_URL: process.env.NEXT_PUBLIC_SIGNAL_NOISE_URL || 'http://localhost:8001',
  BIOPHYSICS_URL: process.env.NEXT_PUBLIC_BIOPHYSICS_URL || 'http://localhost:8002',
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
 * Evita peticiones CORS/mixed-content desde producción hacia `http://localhost:*`
 * cuando no se ha configurado una URL pública para un microservicio opcional.
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

