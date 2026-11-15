'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authStorage, StoredUser } from '../../services/storage';
import {
  Activity,
  HeartPulse,
  CalendarCheck2,
  Rocket,
  Users,
  ShieldAlert,
  LogIn,
  LogOut,
  Menu,
  X,
  Gauge,
  Orbit,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const syncUser = () => {
      setUser(authStorage.getUser());
    };

    syncUser();

    window.addEventListener('artemis:auth-change', syncUser);
    window.addEventListener('artemis:unauthorized', syncUser);

    return () => {
      window.removeEventListener('artemis:auth-change', syncUser);
      window.removeEventListener('artemis:unauthorized', syncUser);
    };
  }, []);

  const handleLogout = () => {
    authStorage.clearSession();
    setUser(null);
    router.push('/login');
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: Activity },
    { href: '/dashboard', label: 'My Health', icon: Gauge },
    { href: '/readings/new', label: 'Log Reading', icon: HeartPulse },
    { href: '/routine', label: 'Routine', icon: CalendarCheck2 },
    { href: '/missions', label: 'Missions', icon: Rocket },
    { href: '/visualizer', label: '3D Orbit', icon: Orbit },
    { href: '/astronauts', label: 'Crew', icon: Users },
  ];

  if (user?.role === 'ADMIN') {
    navLinks.push({ href: '/admin', label: 'Surgeon', icon: ShieldAlert });
  }

  return (
    <header className="sticky top-0 z-50 w-full chrome-translucent backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <Link href="/" className="flex items-center tactile-press">
          <span
            className="text-xl sm:text-2xl font-bold uppercase tracking-[-0.02em] text-[#FFFFFF] leading-none"
            style={{
              fontFamily:
                'ui-rounded, "SF Pro Rounded", var(--font-sans), system-ui, -apple-system, sans-serif',
            }}
          >
            ORBVITAL
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href ||
              (link.href === '/dashboard' && (pathname === '/trends' || pathname === '/vision'));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`tactile-press flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-plate text-ink-inverse font-semibold'
                    : 'text-stem hover:bg-surface-tinted hover:text-blueberry'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-ink-inverse' : 'text-berry'
                  }`}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User session */}
        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 border-l border-line pl-3">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-blueberry leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] font-medium text-berry">
                  {user.role === 'ADMIN' ? 'Flight Surgeon' : 'Astronaut'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="tactile-press flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-stem hover:border-status-critical/40 hover:bg-status-critical/10 hover:text-status-critical"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="tactile-press flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-blueberry hover:bg-surface-tinted"
              >
                <LogIn className="h-3.5 w-3.5 text-berry" />
                <span>Sign in</span>
              </Link>
              <Link
                href="/register"
                className="tactile-press rounded-pill bg-blueberry px-3.5 py-1.5 text-xs font-medium text-plate hover:bg-berry"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="tactile-press rounded-md border border-line bg-surface p-2 text-blueberry hover:bg-surface-tinted"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-b border-line bg-surface/95 backdrop-blur-xl px-4 pt-3 pb-5 lg:hidden animate-materialize">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href === '/dashboard' && pathname === '/trends');

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`tactile-press flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? 'bg-blueberry text-plate'
                      : 'text-blueberry hover:bg-surface-tinted'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-plate' : 'text-berry'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="mt-3 border-t border-line pt-3">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-blueberry">{user.name}</span>
                    <span className="text-xs font-medium text-berry">
                      {user.role === 'ADMIN' ? 'Flight Surgeon' : 'Astronaut'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="tactile-press flex items-center gap-1.5 rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-1.5 text-xs font-medium text-status-critical"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="tactile-press flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface py-2 text-xs font-medium text-blueberry"
                  >
                    <LogIn className="h-3.5 w-3.5 text-berry" />
                    <span>Sign in</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="tactile-press flex items-center justify-center rounded-md bg-blueberry py-2 text-xs font-medium text-plate"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
