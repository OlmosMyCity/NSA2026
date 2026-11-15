import { ENV } from '../config/env';
import { httpClient } from './httpClient';

/**
 * Reloj alineado con el servidor. La vigencia de las lecturas no debe depender
 * del reloj del dispositivo; si el servidor no responde se usa el reloj local.
 */
let offsetMs = 0;
let syncPromise: Promise<number> | null = null;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function syncServerClock(): Promise<number> {
  if (ENV.USE_MOCKS) return Promise.resolve(0);

  syncPromise ??= (async () => {
    try {
      const sentAt = Date.now();
      const res = await httpClient.get<{ timestamp?: string }>('/health');
      const receivedAt = Date.now();
      const serverMs = res?.timestamp ? Date.parse(res.timestamp) : NaN;
      if (Number.isFinite(serverMs)) offsetMs = serverMs - (sentAt + receivedAt) / 2;
    } catch {
      syncPromise = null; // sin conexión: reintenta en la próxima llamada
    }
    return offsetMs;
  })();

  return syncPromise;
}
