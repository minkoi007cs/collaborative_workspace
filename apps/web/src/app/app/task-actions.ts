'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { Task } from '@/lib/api/types';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(form: FormData, name: string) {
  const value = String(form.get(name) ?? '');
  return uuidPattern.test(value) ? value : null;
}
function version(form: FormData) {
  const value = Number(form.get('expectedVersion'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function text(form: FormData, name: string, max: number) {
  const value = String(form.get(name) ?? '').trim();
  return value.length > 0 && value.length <= max ? value : null;
}
function fail(error: unknown, path: string): never {
  if (error instanceof ApiError && error.status === 401) redirect('/login');
  const code =
    error instanceof ApiError && error.status === 409 ? 'conflict' : 'save';
  redirect(`${path}?error=${code}`);
}

export async function createTask(form: FormData) {
  const boardId = uuid(form, 'boardId');
  const columnId = uuid(form, 'columnId');
  const title = text(form, 'title', 200);
  if (!boardId) redirect('/app');
  const path = `/app/boards/${boardId}`;
  if (!columnId || !title) redirect(`${path}?error=invalid`);
  let task: Task;
  try {
    task = await apiRequest<Task>(`/boards/${boardId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, columnId }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`/app/tasks/${task.id}`);
}

export async function updateTask(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const title = text(form, 'title', 200);
  const expectedVersion = version(form);
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const description = String(form.get('description') ?? '').trim();
  const priority = String(form.get('priority') ?? '');
  const dueDate = String(form.get('dueDate') ?? '');
  if (
    !title ||
    !expectedVersion ||
    description.length > 20000 ||
    !['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ||
    (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
  )
    redirect(`${path}?error=invalid`);
  const dueAt = dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null;
  if (
    dueAt &&
    (Number.isNaN(dueAt.getTime()) ||
      dueAt.toISOString().slice(0, 10) !== dueDate)
  )
    redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        expectedVersion,
        title,
        description: description || null,
        priority,
        dueAt: dueAt?.toISOString() ?? null,
        completed: form.get('completed') === 'on',
      }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function moveTask(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const toColumnId = uuid(form, 'toColumnId');
  const beforeTaskId = uuid(form, 'beforeTaskId');
  const expectedVersion = version(form);
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  if (!toColumnId || !expectedVersion) redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify({ toColumnId, beforeTaskId, expectedVersion }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function setTaskAssignees(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const expectedVersion = version(form);
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const userIds = form.getAll('userIds').map(String);
  if (
    !expectedVersion ||
    userIds.length > 50 ||
    userIds.some((id) => !uuidPattern.test(id))
  )
    redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}/assignees`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, userIds }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function setTaskLabels(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const expectedVersion = version(form);
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  const labelIds = form.getAll('labelIds').map(String);
  if (
    !expectedVersion ||
    labelIds.length > 20 ||
    labelIds.some((id) => !uuidPattern.test(id))
  )
    redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}/labels`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, labelIds }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function createTaskLabel(form: FormData) {
  const projectId = uuid(form, 'projectId');
  const taskId = uuid(form, 'taskId');
  const name = text(form, 'name', 50);
  const color = String(form.get('color') ?? '');
  if (!taskId || !projectId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  if (!name || !/^#[0-9a-fA-F]{6}$/.test(color))
    redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/projects/${projectId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function archiveTask(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const boardId = uuid(form, 'boardId');
  const expectedVersion = version(form);
  if (!taskId || !boardId) redirect('/app');
  if (!expectedVersion) redirect(`/app/tasks/${taskId}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });
  } catch (error) {
    fail(error, `/app/tasks/${taskId}`);
  }
  const path = `/app/boards/${boardId}`;
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function copyTask(form: FormData) {
  const taskId = uuid(form, 'taskId');
  if (!taskId) redirect('/app');
  const path = `/app/tasks/${taskId}`;
  let copy: Task;
  try {
    copy = await apiRequest<Task>(`/tasks/${taskId}/copy`, { method: 'POST' });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(`/app/boards/${copy.boardId}`);
  redirect(`/app/tasks/${copy.id}`);
}

export async function deleteTaskPermanent(form: FormData) {
  const taskId = uuid(form, 'taskId');
  const boardId = uuid(form, 'boardId');
  const expectedVersion = version(form);
  if (!taskId || !boardId) redirect('/app');
  if (!expectedVersion) redirect(`/app/tasks/${taskId}?error=invalid`);
  try {
    await apiRequest(`/tasks/${taskId}/permanent`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });
  } catch (error) {
    fail(error, `/app/tasks/${taskId}`);
  }
  const path = `/app/boards/${boardId}`;
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function moveTaskOnBoard(input: {
  taskId: string;
  expectedVersion: number;
  toColumnId: string;
  beforeTaskId: string | null;
}): Promise<{
  task: Task | null;
  error: 'invalid' | 'conflict' | 'save' | 'unauthenticated' | null;
}> {
  if (
    !uuidPattern.test(input.taskId) ||
    !uuidPattern.test(input.toColumnId) ||
    (input.beforeTaskId !== null && !uuidPattern.test(input.beforeTaskId)) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  )
    return { task: null, error: 'invalid' };
  try {
    const task = await apiRequest<Task>(`/tasks/${input.taskId}/move`, {
      method: 'POST',
      body: JSON.stringify({
        toColumnId: input.toColumnId,
        beforeTaskId: input.beforeTaskId,
        expectedVersion: input.expectedVersion,
      }),
    });
    revalidatePath(`/app/boards/${task.boardId}`);
    return { task, error: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      return { task: null, error: 'unauthenticated' };
    if (error instanceof ApiError && error.status === 409)
      return { task: null, error: 'conflict' };
    return { task: null, error: 'save' };
  }
}
