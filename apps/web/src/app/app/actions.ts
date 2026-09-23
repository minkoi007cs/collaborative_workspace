'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifiedAccessToken } from '@/lib/supabase/access-token';

export async function updateProfile(formData: FormData) {
  const displayName = String(formData.get('displayName') ?? '').trim();
  if (displayName.length < 1 || displayName.length > 80)
    redirect('/app?error=invalid-name');
  const token = await verifiedAccessToken();
  if (!token) redirect('/login');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) redirect('/app?error=api');
  const response = await fetch(`${apiUrl}/users/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName }),
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) redirect('/app?error=api');
  revalidatePath('/app');
  redirect('/app?updated=1');
}
