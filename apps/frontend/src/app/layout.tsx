import type { Metadata } from 'next';
import Image from 'next/image';
import { Public_Sans, Space_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/context/AuthContext';

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-public-sans',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Orbvital — Crew Biomedical Telemetry & Health',
  description:
    'Orbvital autonomous clinical monitoring and physiological risk assessment platform for crewed orbital and lunar spaceflight operations.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${publicSans.variable} ${spaceMono.variable}`}>
      <body className="relative bg-transparent text-blueberry font-sans antialiased">
        {/* Global full-viewport web1.jpg background — flat 20% dim, no floating gradient */}
        <div className="fixed inset-0 -z-10 pointer-events-none select-none overflow-hidden bg-canvas">
          <Image
            src="/images/web1.jpg"
            alt=""
            fill
            priority
            quality={95}
            className="object-cover object-center"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-canvas/20" />
        </div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
