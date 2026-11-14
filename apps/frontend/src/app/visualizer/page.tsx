'use client';

import React, { useState } from 'react';
import { Orbit, Dna } from 'lucide-react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { OrbitTrajectoryViewer } from '@/features/visualizer/components/OrbitTrajectoryViewer';
import { MolecularTwinSection } from '@/features/visualizer/components/MolecularTwinSection';

export default function VisualizerPage() {
  const [tab, setTab] = useState<'orbit' | 'molecular'>('orbit');

  return (
    <AppLayout>
      <div className="py-6 sm:py-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
              3D Mission & Biophysics Visualizer
            </h1>
            <p className="mt-1.5 text-sm text-stem max-w-2xl">
              Explore multi-mission orbital trajectories (Spacecraft, Station, Lunar Base, Mars
              Transit) or inspect A100 molecular docking and DNA repair kinetics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('orbit')}
              className={`tactile-press inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-semibold transition ${
                tab === 'orbit'
                  ? 'bg-blueberry text-white shadow-sm'
                  : 'border border-line bg-surface text-stem hover:text-blueberry'
              }`}
            >
              <Orbit className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Mission Trajectories</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('molecular')}
              className={`tactile-press inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-semibold transition ${
                tab === 'molecular'
                  ? 'bg-blueberry text-white shadow-sm'
                  : 'border border-line bg-surface text-stem hover:text-blueberry'
              }`}
            >
              <Dna className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Molecular Twin (A100)</span>
            </button>
          </div>
        </div>

        {tab === 'orbit' ? <OrbitTrajectoryViewer /> : <MolecularTwinSection />}
      </div>
    </AppLayout>
  );
}
