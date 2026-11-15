/**
 * Configuración centralizada de variables de entorno para el cliente frontend.
 *
 * API_HOST: en producción frontend y backend comparten dominio (vercel.json enruta `/api/*`
 * al backend), así que por defecto es la ruta relativa `/api`; en `next dev` el backend
 * corre aparte en el puerto 4000.
 */
const DEFAULT_API_HOST = process.env.NODE_ENV === 'development' ? 'http://localhost:4000/api' : '/api';

export const ENV = {
  API_HOST: process.env.NEXT_PUBLIC_API_HOST || DEFAULT_API_HOST,
  VISION_URL: process.env.NEXT_PUBLIC_VISION_URL || 'http://localhost:8000',
  USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === 'true',
  /** Minutos de vigencia de los signos vivos; debe coincidir con FRESHNESS_WINDOW_MIN del backend. */
  FRESHNESS_WINDOW_MIN: Number(process.env.NEXT_PUBLIC_FRESHNESS_WINDOW_MIN) > 0
    ? Number(process.env.NEXT_PUBLIC_FRESHNESS_WINDOW_MIN)
    : 15,
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

