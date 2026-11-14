'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Focus, RotateCcw } from 'lucide-react';

interface MoleculeViewer3DProps {
  pdbPath: string;
  title: string;
  focusedResidue?: string | null;
}

declare global {
  interface Window {
    $3Dmol?: {
      createViewer: (
        element: HTMLElement,
        config: { backgroundColor: string }
      ) => {
        clear: () => void;
        addModel: (data: string, format: string) => void;
        setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
        zoomTo: (sel?: Record<string, unknown>) => void;
        render: () => void;
        spin: (axis: string, speed?: number) => void;
      };
    };
  }
}

const THREEDMOL_CDN = 'https://3Dmol.org/build/3Dmol-min.js';

function load3DmolScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.$3Dmol) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${THREEDMOL_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load 3Dmol.js')));
      return;
    }
    const script = document.createElement('script');
    script.src = THREEDMOL_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js (offline or blocked)'));
    document.head.appendChild(script);
  });
}

export function MoleculeViewer3D({ pdbPath, title, focusedResidue }: MoleculeViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ReturnType<NonNullable<Window['$3Dmol']>['createViewer']> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const loadModel = useCallback(async (isCancelled: () => boolean) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await load3DmolScript();
      const pdbRes = await fetch(pdbPath);
      if (!pdbRes.ok) {
        throw new Error(`Structure not found (${pdbPath})`);
      }
      const pdbText = await pdbRes.text();
      if (isCancelled() || !containerRef.current || !window.$3Dmol) return;

      containerRef.current.innerHTML = '';
      const viewer = window.$3Dmol.createViewer(containerRef.current, {
        backgroundColor: '#090c14',
      });
      viewerRef.current = viewer;

      viewer.addModel(pdbText, 'pdb');
      viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.85 } });
      viewer.setStyle(
        { hetflag: true, not: { resn: ['HOH', 'WAT'] } },
        { stick: { radius: 0.3, colorscheme: 'greenCarbon' }, sphere: { scale: 0.25 } }
      );
      viewer.zoomTo();
      viewer.render();
      setStatus('ready');
    } catch (err) {
      if (!isCancelled()) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Unable to render 3D structure.');
      }
    }
  }, [pdbPath]);

  useEffect(() => {
    let cancelled = false;
    loadModel(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadModel, reloadNonce]);

  useEffect(() => {
    if (!viewerRef.current || status !== 'ready' || !focusedResidue) return;
    const resNumMatch = focusedResidue.match(/\d+/);
    if (resNumMatch) {
      const resi = Number(resNumMatch[0]);
      viewerRef.current.setStyle({ resi }, { stick: { radius: 0.35, colorscheme: 'yellowCarbon' } });
      viewerRef.current.zoomTo({ resi });
      viewerRef.current.render();
    }
  }, [focusedResidue, status]);

  const handleResetView = () => {
    if (!viewerRef.current) return;
    viewerRef.current.zoomTo();
    viewerRef.current.render();
  };

  const handleFocusPocket = () => {
    if (!viewerRef.current) return;
    viewerRef.current.zoomTo({ hetflag: true, not: { resn: ['HOH', 'WAT'] } });
    viewerRef.current.render();
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2 text-xs">
        <span className="font-mono text-blueberry truncate">{title}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleFocusPocket}
            className="tactile-press inline-flex items-center gap-1 rounded border border-line px-2 py-1 font-mono text-[11px] text-stem hover:border-berry hover:text-blueberry"
          >
            <Focus className="h-3 w-3 text-berry" aria-hidden="true" />
            Pocket
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="tactile-press inline-flex items-center gap-1 rounded border border-line px-2 py-1 font-mono text-[11px] text-stem hover:border-berry hover:text-blueberry"
          >
            <RotateCcw className="h-3 w-3 text-berry" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <div ref={containerRef} className="h-[320px] w-full" />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 top-9 flex items-center justify-center bg-canvas/85 font-mono text-xs text-stem">
          Loading A100 PDB structure...
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 top-9 flex flex-col items-center justify-center gap-2 bg-canvas/95 p-4 text-center font-mono text-xs text-status-critical">
          <p>{errorMsg}</p>
          <p className="text-[11px] text-stem">Source: {pdbPath}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="tactile-press mt-1 rounded border border-line px-3 py-1 text-blueberry hover:border-berry"
          >
            Retry 3D Viewer
          </button>
        </div>
      )}
    </div>
  );
}
