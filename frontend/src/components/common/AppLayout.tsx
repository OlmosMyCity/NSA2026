'use client';

import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { IncidentNotificationCenter } from '@/components/radiation/IncidentNotificationCenter';
import { FreshnessReminder } from '@/components/health/FreshnessReminder';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-transparent text-blueberry overflow-x-clip">
      <Navbar />
      <FreshnessReminder />
      <main className="flex-1 w-full max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <IncidentNotificationCenter />
    </div>
  );
}

