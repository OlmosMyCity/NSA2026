'use client';

import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { RadiationStatusBanner } from '@/features/radiation/components/RadiationStatusBanner';
import { IncidentNotificationCenter } from '@/features/radiation/components/IncidentNotificationCenter';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-transparent text-blueberry overflow-x-hidden">
      <Navbar />
      <RadiationStatusBanner />
      <main className="flex-1 w-full max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <IncidentNotificationCenter />
      <Footer />
    </div>
  );
}

