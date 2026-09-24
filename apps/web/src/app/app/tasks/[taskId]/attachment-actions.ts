'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { TaskAttachment } from '@/lib/api/types';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.';
    if (error.status === 429) return 'Too many uploads. Try again later.';
    if (error.status === 503)
      return 'File storage is unavailable. Try again later.';
  }
  return 'Could not save this file. Try again.';
}

export async function requestAttachmentUpload(
  taskId: string,
  fileName: string,
  contentType: string,
  size: number,
) {
  if (
    !uuid.test(taskId) ||
    !fileName.trim() ||
    fileName.length > 255 ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    Array.from(fileName).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    !allowed.includes(contentType) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 10 * 1024 * 1024
  )
    return { error: 'Choose a supported file under 10 MB.' } as const;
  try {
    return await apiRequest<{ attachment: TaskAttachment; signedUrl: string }>(
      `/tasks/${taskId}/attachments/upload-url`,
      {
        method: 'POST',
        body: JSON.stringify({ fileName: fileName.trim(), contentType, size }),
      },
    );
  } catch (error) {
    return { error: message(error) } as const;
  }
}

export async function finishAttachmentUpload(
  taskId: string,
  attachmentId: string,
) {
  if (!uuid.test(taskId) || !uuid.test(attachmentId))
    return { error: 'Invalid file.' } as const;
  try {
    await apiRequest(`/tasks/${taskId}/attachments/${attachmentId}/finalize`, {
      method: 'POST',
    });
    revalidatePath(`/app/tasks/${taskId}`);
    return { ok: true } as const;
  } catch (error) {
    return { error: message(error) } as const;
  }
}

export async function deleteAttachment(taskId: string, attachmentId: string) {
  if (!uuid.test(taskId) || !uuid.test(attachmentId))
    return { error: 'Invalid file.' } as const;
  try {
    await apiRequest(`/attachments/${attachmentId}`, { method: 'DELETE' });
    revalidatePath(`/app/tasks/${taskId}`);
    return { ok: true } as const;
  } catch (error) {
    return { error: message(error) } as const;
  }
}
