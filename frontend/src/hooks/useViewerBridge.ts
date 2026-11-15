'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { MissionEvent, MissionPhase } from '../domain/visualizer/missionClock';

/** PostMessage bridge protocol defined by the embedded 3D flight-dynamics viewer (`embed.js`). */
const HOST = 'artemis-host';
const VIEWER = 'artemis-viewer';

export interface ViewerReady {
  tEnd: number;
  phases: MissionPhase[];
  events: MissionEvent[];
}

export interface ViewerTime {
  t: number;
  phaseId: string;
  playing: boolean;
}

/**
 * Bidirectional `postMessage` bridge hook synchronizing React UI state with the
 * same-origin embedded 3D orbital viewer iframe (`ready`/`time` events and `seek`/`play`/`pause` commands).
 */
export function useViewerBridge(frameRef: RefObject<HTMLIFrameElement>, src?: string | null) {
  const [ready, setReady] = useState<ViewerReady | null>(null);
  const [time, setTime] = useState<ViewerTime | null>(null);

  useEffect(() => {
    setReady(null);
    setTime(null);
  }, [src]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Accept messages only from the embedded same-origin viewer iframe.
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || d.source !== VIEWER) return;
      if (d.type === 'ready' && Array.isArray(d.phases)) {
        setReady({ tEnd: Number(d.tEnd), phases: d.phases, events: d.events ?? [] });
      } else if (d.type === 'time' && typeof d.t === 'number') {
        setTime({ t: d.t, phaseId: String(d.phaseId), playing: Boolean(d.playing) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frameRef]);

  const send = useCallback(
    (msg: Record<string, unknown>) => {
      frameRef.current?.contentWindow?.postMessage({ source: HOST, ...msg }, window.location.origin);
    },
    [frameRef],
  );

  return {
    ready,
    time,
    seek: useCallback((t: number) => send({ type: 'seek', t }), [send]),
    play: useCallback(() => send({ type: 'play' }), [send]),
    pause: useCallback(() => send({ type: 'pause' }), [send]),
  };
}
