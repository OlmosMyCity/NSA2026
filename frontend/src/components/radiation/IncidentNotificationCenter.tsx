'use client';

import { useEffect, useState } from 'react';
import { ENV } from '@/config/env';
import { authStorage } from '@/services/storage';
import { RadiationIncident, radiationService } from '../../services/radiationService';

const AUTO_DISMISS_MS = 8_000;

interface LiveNotification {
  id: string;
  event: 'incident:opened' | 'incident:escalated';
  incident: RadiationIncident;
  reason?: string;
}

/**
 * Floating real-time incident notification toast center backed by Server-Sent Events (SSE).
 * Subscribes to `/incidents/stream` with automatic reconnect backoff when authenticated,
 * rendering up to 4 active alerts with one-click incident acknowledgement.
 */
export function IncidentNotificationCenter() {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  useEffect(() => {
    const token = authStorage.getToken();
    // En modo mock no hay backend que emita incidentes por SSE
    if (!token || ENV.USE_MOCKS) return;

    const controller = new AbortController();
    let active = true;

    async function connect() {
      while (active && !controller.signal.aborted) {
        try {
          const base = ENV.API_HOST.replace(/\/+$/, '');
          const res = await fetch(`${base}/incidents/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            await new Promise((r) => setTimeout(r, 15_000));
            continue;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (active) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
              const lines = frame.split('\n');
              let eventName = '';
              let dataRaw = '';
              for (const line of lines) {
                if (line.startsWith('event:')) eventName = line.slice(6).trim();
                if (line.startsWith('data:')) dataRaw += line.slice(5).trim();
              }

              if (!dataRaw) continue;
              if (eventName === 'incident:opened' || eventName === 'incident:escalated') {
                const typedEvent: LiveNotification['event'] = eventName;
                const parsed = JSON.parse(dataRaw) as {
                  incident: RadiationIncident;
                  reason?: string;
                };
                setNotifications((prev) => {
                  const filtered = prev.filter((n) => n.incident.id !== parsed.incident.id);
                  return [
                    {
                      id: `${parsed.incident.id}-${Date.now()}`,
                      event: typedEvent,
                      incident: parsed.incident,
                      reason: parsed.reason,
                    },
                    ...filtered,
                  ].slice(0, 4);
                });
              } else if (
                eventName === 'incident:acknowledged' ||
                eventName === 'incident:closed'
              ) {
                const parsed = JSON.parse(dataRaw) as { incident: RadiationIncident };
                setNotifications((prev) =>
                  prev.filter((n) => n.incident.id !== parsed.incident.id)
                );
              }
            }
          }
        } catch {
          if (controller.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 10_000));
        }
      }
    }

    void connect();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Auto-ocultar el aviso tras unos segundos; un nuevo evento reinicia el temporizador
  const latest = notifications[0];
  const latestId = latest?.id;
  useEffect(() => {
    if (!latestId) return;
    const timer = setTimeout(() => setNotifications([]), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [latestId]);

  if (!latest) return null;

  const handleAck = async (incidentId: string) => {
    try {
      await radiationService.acknowledgeIncident(incidentId);
      setNotifications((prev) => prev.filter((n) => n.incident.id !== incidentId));
    } catch {
      // ignore transient errors
    }
  };

  const escalated = latest.event === 'incident:escalated';
  const critical = escalated || latest.incident.severity === 'CRITICAL';
  const extra = notifications.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] flex items-center gap-2.5 rounded-lg border border-line bg-[hsl(var(--hsl-surface-elevated)/0.92)] backdrop-blur px-3 py-2 shadow-lg text-xs"
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${critical ? 'bg-status-critical' : 'bg-status-caution'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-blueberry">
          {escalated ? 'Incidente sin confirmar' : 'Nuevo incidente'}
          {extra > 0 && <span className="ml-1 font-normal text-stem">+{extra}</span>}
        </p>
        <p className="truncate text-stem">{latest.incident.title}</p>
      </div>
      <button
        type="button"
        onClick={() => handleAck(latest.incident.id)}
        className="shrink-0 rounded px-2 py-1 font-semibold text-berry hover:bg-surface-hover"
      >
        Confirmar
      </button>
      <button
        type="button"
        onClick={() => setNotifications([])}
        className="shrink-0 px-1 text-stem hover:text-blueberry"
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  );
}
