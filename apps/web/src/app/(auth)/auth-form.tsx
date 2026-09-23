'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { supabaseConfig } from '@/lib/supabase/config';

export function AuthForm({
  mode,
  callbackError = false,
  nextPath = '/app',
}: {
  mode: 'login' | 'signup';
  callbackError?: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    callbackError ? 'Sign in could not be completed. Please try again.' : '',
  );
  const configured = Boolean(supabaseConfig());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const client = browserClient();
      if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(nextPath);
        router.refresh();
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(nextPath);
          router.refresh();
        } else {
          setMessage('Check your email for a confirmation link, then sign in.');
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Authentication failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await browserClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Google sign in failed.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <p className="eyebrow">
          {mode === 'login' ? 'Welcome back' : 'Start collaborating'}
        </p>
        <h1>
          {mode === 'login' ? 'Sign in to SyncSpace' : 'Create your account'}
        </h1>
        <p className="auth-intro">
          {mode === 'login'
            ? 'Pick up where your team left off.'
            : 'Your shared workspace starts here.'}
        </p>
        {!configured && (
          <p className="notice" role="status">
            Account access is temporarily unavailable. Please try again later.
          </p>
        )}
        <form onSubmit={submit} className="auth-fields">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!configured || busy}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!configured || busy}
          />
          <button
            className="primary-button"
            type="submit"
            disabled={!configured || busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
        <div className="auth-divider">
          <span>or</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={googleSignIn}
          disabled={!configured || busy}
        >
          Continue with Google
        </button>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        <p className="auth-switch">
          {mode === 'login' ? 'New to SyncSpace?' : 'Already have an account?'}{' '}
          <Link
            href={`${mode === 'login' ? '/signup' : '/login'}${nextPath !== '/app' ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </div>
    </main>
  );
}
