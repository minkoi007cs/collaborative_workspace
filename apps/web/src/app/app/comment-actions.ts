'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(form: FormData, key: string) {
  const value = String(form.get(key) ?? '');
  return uuidPattern.test(value) ? value : null;
}
function version(form: FormData) {
  const value = Number(form.get('expectedVersion'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function failed(error: unknown, path: string): never {
  if (error instanceof ApiError && error.status === 401) redirect('/login');
  revalidatePath(path);
  redirect(
    `${path}?commentError=${error instanceof ApiError && error.status === 409 ? 'conflict' : 'save'}`,
  );
}

export async function createComment(form: FormData) {
  const taskId = uuid(form, 'taskId');
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const content = String(form.get('content') ?? '').trim();
  if (!content || content.length > 4000)
    redirect(`${path}?commentError=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  } catch (error) {
    failed(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?comment=created`);
}

export async function updateComment(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const commentId = uuid(form, 'commentId');
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const content = String(form.get('content') ?? '').trim();
  const expectedVersion = version(form);
  if (!commentId || !expectedVersion || !content || content.length > 4000)
    redirect(`${path}?commentError=invalid`);
  try {
    await apiRequest(`/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content, expectedVersion }),
    });
  } catch (error) {
    failed(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?comment=updated`);
}

export async function deleteComment(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const commentId = uuid(form, 'commentId');
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const expectedVersion = version(form);
  if (!commentId || !expectedVersion) redirect(`${path}?commentError=invalid`);
  try {
    await apiRequest(`/comments/${commentId}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });
  } catch (error) {
    failed(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?comment=deleted`);
}
