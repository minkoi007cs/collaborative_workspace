'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';

function checkAuth(error: unknown) {
  if (error instanceof ApiError && error.status === 401) redirect('/login');
}

export async function markNotificationRead(form: FormData) {
  const id = String(form.get('id') ?? '');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    redirect('/app/notifications?error=invalid');
  try {
    await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
  } catch (error) {
    checkAuth(error);
    redirect('/app/notifications?error=save');
  }
  revalidatePath('/app');
  revalidatePath('/app/notifications');
  redirect('/app/notifications');
}

export async function markAllNotificationsRead() {
  try {
    await apiRequest('/notifications/read-all', { method: 'POST' });
  } catch (error) {
    checkAuth(error);
    redirect('/app/notifications?error=save');
  }
  revalidatePath('/app');
  revalidatePath('/app/notifications');
  redirect('/app/notifications');
}
