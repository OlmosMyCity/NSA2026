'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '@/features/common/services/httpClient';
import { AlertCircle } from 'lucide-react';

export function RegisterForm() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Complete all fields to continue.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Could not create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md surface-card p-6 sm:p-8 animate-materialize">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-blueberry">
          Create account
        </h1>
        <p className="mt-1.5 text-sm text-stem">
          Register to track your vital signs and daily countermeasure routine.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="mt-6 ui-callout-critical flex items-start gap-2.5 text-xs text-status-critical">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="reg-name"
            className="block text-xs font-semibold text-blueberry"
          >
            Full name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jeremy Hansen"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="block text-xs font-semibold text-blueberry"
          >
            Email address
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="j.hansen@nasa.gov"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="block text-xs font-semibold text-blueberry"
          >
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <div>
          <label
            htmlFor="reg-confirm-password"
            className="block text-xs font-semibold text-blueberry"
          >
            Confirm password
          </label>
          <input
            id="reg-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tactile-press mt-2 w-full rounded-sm bg-blueberry py-2.5 text-sm font-semibold text-plate hover:bg-berry disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-stem">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-blueberry hover:text-berry transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
