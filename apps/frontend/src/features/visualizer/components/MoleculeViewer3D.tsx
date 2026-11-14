'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface MoleculeViewer3DProps {
  pdbPath: string;
  title: string;
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
        zoomTo: () => void;
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
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
    document.head.appendChild(script);
  });
}

export function MoleculeViewer3D({ pdbPath, title }: MoleculeViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ReturnType<NonNullable<Window['$3Dmol']>['createViewer']> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus('loading');
      setErrorMsg('');
      try {
        await load3DmolScript();
        const pdbRes = await fetch(pdbPath);
        if (!pdbRes.ok) {
          throw new Error(`Structure not found (${pdbPath})`);
        }
        const pdbText = await pdbRes.text();
        if (cancelled || !containerRef.current || !window.$3Dmol) return;

        containerRef.current.innerHTML = '';
        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: '#070d18',
        });
        viewerRef.current = viewer;

        viewer.addModel(pdbText, 'pdb');
        viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.88 } });
        // Highlight docked small-molecule ligands (HETATM) and nucleic acids
        viewer.setStyle(
          { hetflag: true, not: { resn: ['HOH', 'WAT'] } },
          { stick: { radius: 0.28, colorscheme: 'greenCarbon' }, sphere: { scale: 0.25 } }
        );
        viewer.zoomTo();
        viewer.render();
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Unable to render 3D structure.');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [pdbPath]);

  const handleResetView = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-[#070d18]">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 text-xs">
        <span className="font-mono text-slate-300 truncate">{title}</span>
        <button
          type="button"
          onClick={handleResetView}
          className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-white/30 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div ref={containerRef} className="h-[320px] w-full" />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 top-9 flex items-center justify-center bg-[#070d18]/80 font-mono text-xs text-slate-300">
          Loading A100 PDB structure...
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 top-9 flex flex-col items-center justify-center bg-[#070d18]/95 p-4 text-center font-mono text-xs text-rose-300">
          <p>{errorMsg}</p>
          <p className="mt-1 text-[11px] text-slate-400">Source: {pdbPath}</p>
        </div>
      )}
    </div>
  );
}
