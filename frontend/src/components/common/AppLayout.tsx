'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { IncidentNotificationCenter } from '@/components/radiation/IncidentNotificationCenter';
import { FreshnessReminder } from '@/components/health/FreshnessReminder';
import { FollowUpStickyNote } from '@/components/health/FollowUpStickyNote';
import { OnboardingModal } from './OnboardingModal';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen flex-col bg-transparent text-blueberry overflow-x-clip">
      <Navbar />
      <FreshnessReminder />
      <FollowUpStickyNote />
      <main className="flex-1 w-full max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <IncidentNotificationCenter />
      <OnboardingModal />
    </div>
  );
}

