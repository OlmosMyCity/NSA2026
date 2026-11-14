'use client';

import React, { useState } from 'react';
import { Maximize2, Minimize2, Orbit, Rocket, Globe, ExternalLink } from 'lucide-react';

export function OrbitTrajectoryViewer() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className="space-y-6">
      {/* 3D orbital viewer container */}
      <div
        className={`relative overflow-hidden border border-line bg-[#060911] transition-all duration-panel ease-out-expo ${
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
            : 'rounded-lg h-[620px] w-full shadow-lg'
        }`}
      >
        {/* Translucent top control bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          <div className="chrome-translucent flex items-center gap-2 rounded-pill border border-line px-3.5 py-1.5 shadow-sm">
            <Orbit className="h-4 w-4 text-blueberry" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-blueberry tracking-wide">
              Artemis IV Flight Dynamics · NRHO Orbit
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/visualizer/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="tactile-press chrome-translucent flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:border-blueberry shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              <span className="hidden sm:inline">Open in new tab</span>
            </a>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="tactile-press chrome-translucent flex items-center gap-1.5 rounded-pill border border-line px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:border-blueberry shadow-sm"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  <span>Exit fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Embedded 3D trajectory iframe */}
        <iframe
          src="/visualizer/index.html"
          title="Orbvital 3D Artemis IV Flight Dynamics Viewer"
          className="h-full w-full border-0"
          loading="lazy"
        />
      </div>

      {/* Orbital mechanics reference cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Globe className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>Trans-Lunar Injection (TLI)</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            SLS Block 1B accelerates the Orion spacecraft to{' '}
            <span className="tabular-nums font-medium text-blueberry">39,000 km/h</span> to escape
            low Earth orbit and enter the cislunar transfer arc.
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Orbit className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>Gateway NRHO Orbit</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            Near-Rectilinear Halo Orbit in{' '}
            <span className="tabular-nums font-medium text-blueberry">9:2</span> lunar resonance.
            Perilune at <span className="tabular-nums font-medium text-blueberry">3,000 km</span>{' '}
            (north pole) and apolune at{' '}
            <span className="tabular-nums font-medium text-blueberry">70,000 km</span> (south pole).
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-blueberry text-xs font-semibold mb-1.5">
            <Rocket className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>I-Hab Module &amp; Docking</span>
          </div>
          <p className="text-xs text-stem leading-relaxed">
            Artemis IV delivers the ESA/JAXA International Habitat (I-Hab) to Gateway before
            lunar surface descent aboard Starship HLS.
          </p>
        </div>
      </div>
    </div>
  );
}
