'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error } = await browserClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      router.push('/login');
      router.refresh();
    } catch {
      setError('Could not sign out. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="text-button"
        type="button"
        onClick={signOut}
        disabled={busy}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && (
        <p role="alert" className="form-message">
          {error}
        </p>
      )}
    </div>
  );
}
