'use client';

import { useEffect, useState } from 'react';
import { ENV } from '@/features/common/config/env';
import { authStorage } from '@/features/common/services/storage';
import { RadiationIncident, radiationService } from '../services/radiationService';

interface LiveNotification {
  id: string;
  event: 'incident:opened' | 'incident:escalated';
  incident: RadiationIncident;
  reason?: string;
}

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

  if (notifications.length === 0) return null;

  const handleAck = async (incidentId: string) => {
    try {
      await radiationService.acknowledgeIncident(incidentId);
      setNotifications((prev) => prev.filter((n) => n.incident.id !== incidentId));
    } catch {
      // ignore transient errors
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border p-3.5 shadow-lg backdrop-blur bg-white/95 text-xs ${
            item.event === 'incident:escalated' || item.incident.severity === 'CRITICAL'
              ? 'border-rose-500/60'
              : 'border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                item.event === 'incident:escalated'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500/20 text-amber-900'
              }`}
            >
              {item.event === 'incident:escalated' ? 'ESCALADO · SIN CONFIRMAR' : 'NUEVO INCIDENTE'}
            </span>
            <button
              type="button"
              onClick={() =>
                setNotifications((prev) => prev.filter((n) => n.incident.id !== item.incident.id))
              }
              className="text-blueberry/60 hover:text-blueberry"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
          <p className="mt-1.5 font-bold text-blueberry">{item.incident.title}</p>
          <p className="mt-0.5 text-blueberry/80 line-clamp-2">{item.incident.description}</p>
          {item.reason && <p className="mt-1 text-rose-700 font-medium">{item.reason}</p>}
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => handleAck(item.incident.id)}
              className="px-2.5 py-1 rounded bg-blueberry text-white font-semibold hover:opacity-90"
            >
              Confirmar (Acknowledge)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
