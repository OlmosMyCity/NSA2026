'use client';

import React from 'react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { OrbitTrajectoryViewer } from '@/features/visualizer/components/OrbitTrajectoryViewer';
import { MolecularTwinSection } from '@/features/visualizer/components/MolecularTwinSection';

export default function VisualizerPage() {
  return (
    <AppLayout>
      <div className="py-6 sm:py-8">
        <div className="border-b border-line pb-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            3D Mission Orbit Visualizer
          </h1>
          <p className="mt-1.5 text-sm text-stem max-w-2xl">
            Real-time cislunar trajectory simulation: from Earth departure to Gateway station and
            NRHO orbital maneuvers.
          </p>
        </div>

        <OrbitTrajectoryViewer />
        <MolecularTwinSection />
      </div>
    </AppLayout>
  );
}
