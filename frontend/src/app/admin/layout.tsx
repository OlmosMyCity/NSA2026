import React from 'react';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

type AdminCheckResult = 'ADMIN' | 'NON_ADMIN' | 'UNAUTHENTICATED';

function decodeBase64Url(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function verifyJwtWithSecret(token: string, secret: string): AdminCheckResult {
  const parts = token.split('.');
  if (parts.length !== 3) return 'UNAUTHENTICATED';

  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(decodeBase64Url(headerB64).toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return 'UNAUTHENTICATED';

    const expectedSig = createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const providedSig = decodeBase64Url(sigB64);

    if (expectedSig.length !== providedSig.length || !timingSafeEqual(expectedSig, providedSig)) {
      return 'UNAUTHENTICATED';
    }

    const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return 'UNAUTHENTICATED';
    }

    return payload.role === 'ADMIN' ? 'ADMIN' : 'NON_ADMIN';
  } catch {
    return 'UNAUTHENTICATED';
  }
}

function resolveServerApiBase(): string | null {
  const cleanHost = ENV.API_HOST.replace(/\/+$/, '');
  if (cleanHost.startsWith('http://') || cleanHost.startsWith('https://')) {
    return cleanHost;
  }

  const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/+$/, '');
  const path = cleanHost.startsWith('/') ? cleanHost : `/${cleanHost}`;
  if (backendUrl) {
    return `${backendUrl}${path}`;
  }

  const headerList = headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  if (!host) return null;

  const proto = headerList.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}${path}`;
}

async function verifyAdminSession(token: string): Promise<AdminCheckResult> {
  if (process.env.JWT_SECRET) {
    return verifyJwtWithSecret(token, process.env.JWT_SECRET);
  }

  const apiBase = resolveServerApiBase();
  if (!apiBase) return 'UNAUTHENTICATED';

  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return 'UNAUTHENTICATED';

    const data = (await res.json()) as { user?: { role?: string } };
    return data?.user?.role === 'ADMIN' ? 'ADMIN' : 'NON_ADMIN';
  } catch {
    return 'UNAUTHENTICATED';
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('artemis_auth_token')?.value;
  const roleCookie = cookieStore.get('artemis_auth_role')?.value;

  if (!token) {
    redirect('/login?returnUrl=%2Fadmin');
  }

  if (process.env.NODE_ENV !== 'production' && ENV.USE_MOCKS) {
    if (roleCookie !== 'ADMIN') redirect('/?access_denied=true');
    return <>{children}</>;
  }

  const status = await verifyAdminSession(token);
  if (status === 'UNAUTHENTICATED') {
    redirect('/login?returnUrl=%2Fadmin');
  }
  if (status !== 'ADMIN') {
    redirect('/?access_denied=true');
  }

  return <>{children}</>;
}
