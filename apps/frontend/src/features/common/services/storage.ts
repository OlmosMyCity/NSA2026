/**
 * SSR-safe session persistence helper synchronizing auth tokens and user metadata
 * across `localStorage`, cookies (for Next.js middleware), and window auth events.
 *
 * @module features/common/services/storage
 */

const TOKEN_KEY = 'artemis_auth_token';
const USER_KEY = 'artemis_auth_user';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'OPERATOR';
  astronautId?: string;
}

function getSecureCookieSuffix(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

export const authStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      document.cookie = `artemis_auth_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax${getSecureCookieSuffix()}`;
      window.dispatchEvent(new Event('artemis:auth-change'));
    } catch {
      // Ignore if localStorage is blocked or unavailable
    }
  },

  getUser(): StoredUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? (JSON.parse(data) as StoredUser) : null;
    } catch {
      return null;
    }
  },

  setUser(user: StoredUser): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      document.cookie = `artemis_auth_role=${encodeURIComponent(user.role)}; path=/; max-age=86400; SameSite=Lax${getSecureCookieSuffix()}`;
      window.dispatchEvent(new Event('artemis:auth-change'));
    } catch {
      // Ignore storage errors
    }
  },

  clearSession(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      const secure = getSecureCookieSuffix();
      document.cookie = `artemis_auth_token=; path=/; max-age=0; SameSite=Lax${secure}`;
      document.cookie = `artemis_auth_role=; path=/; max-age=0; SameSite=Lax${secure}`;
      window.dispatchEvent(new Event('artemis:auth-change'));
    } catch {
      // Ignore storage errors
    }
  },

  notifyUnauthorized(): void {
    this.clearSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('artemis:unauthorized'));
    }
  },
};

