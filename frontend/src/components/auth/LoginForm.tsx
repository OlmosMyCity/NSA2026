'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '@/services/httpClient';
import { AlertCircle } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpiredNotice(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSessionExpiredNotice(false);

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email: email.trim(), password });
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to sign in. Check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md surface-card p-6 sm:p-8 shadow-sm animate-materialize">
      <div className="border-b border-line pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-blueberry">
          Sign in
        </h1>
        <p className="mt-1.5 text-sm text-stem">
          Sign in with your Orbvital crew or flight medical personnel account.
        </p>
      </div>

      {sessionExpiredNotice && (
        <div role="alert" className="mt-6 ui-callout-caution flex items-start gap-2.5 text-xs text-status-caution">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Your session has expired. Please sign in again to continue.</span>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mt-6 ui-callout-critical flex items-start gap-2.5 text-xs text-status-critical">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-blueberry"
          >
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@nasa.gov"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-blueberry"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tactile-press mt-2 w-full rounded-sm bg-blueberry py-2.5 text-sm font-semibold text-plate hover:bg-berry disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Continue'}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-stem">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-blueberry hover:text-berry transition-colors"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
