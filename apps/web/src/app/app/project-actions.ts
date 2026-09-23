'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { Board, Project } from '@/lib/api/types';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(form: FormData, key: string) {
  const value = String(form.get(key) ?? '');
  return uuidPattern.test(value) ? value : null;
}
function field(form: FormData, key: string, max = 100) {
  const value = String(form.get(key) ?? '').trim();
  return value && value.length <= max ? value : null;
}
function version(form: FormData) {
  const value = Number(form.get('expectedVersion'));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function fail(error: unknown, path: string): never {
  if (error instanceof ApiError && error.status === 401) redirect('/login');
  const code =
    error instanceof ApiError && error.status === 409 ? 'conflict' : 'save';
  redirect(`${path}?error=${code}`);
}

export async function createProject(form: FormData) {
  const workspaceId = uuid(form, 'workspaceId');
  const name = field(form, 'name');
  const description = String(form.get('description') ?? '').trim();
  if (!workspaceId) redirect('/app');
  const path = `/app/workspaces/${workspaceId}`;
  if (!name || description.length > 2000) redirect(`${path}?error=invalid`);
  let project: Project;
  try {
    project = await apiRequest<Project>(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, description: description || null }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`/app/projects/${project.id}`);
}

export async function updateProject(form: FormData) {
  const projectId = uuid(form, 'projectId');
  const name = field(form, 'name');
  const description = String(form.get('description') ?? '').trim();
  if (!projectId) redirect('/app');
  const path = `/app/projects/${projectId}`;
  if (!name || description.length > 2000) redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, description: description || null }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function archiveProject(form: FormData) {
  const projectId = uuid(form, 'projectId');
  const workspaceId = uuid(form, 'workspaceId');
  if (!projectId || !workspaceId) redirect('/app');
  try {
    await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
  } catch (error) {
    fail(error, `/app/projects/${projectId}`);
  }
  const path = `/app/workspaces/${workspaceId}`;
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function createBoard(form: FormData) {
  const projectId = uuid(form, 'projectId');
  const name = field(form, 'name');
  if (!projectId) redirect('/app');
  const path = `/app/projects/${projectId}`;
  if (!name) redirect(`${path}?error=invalid`);
  let board: Board;
  try {
    board = await apiRequest<Board>(`/projects/${projectId}/boards`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`/app/boards/${board.id}`);
}

export async function addColumn(form: FormData) {
  const boardId = uuid(form, 'boardId');
  const name = field(form, 'name');
  const expectedVersion = version(form);
  if (!boardId) redirect('/app');
  const path = `/app/boards/${boardId}`;
  if (!name || !expectedVersion) redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name, expectedVersion }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function renameColumn(form: FormData) {
  const boardId = uuid(form, 'boardId');
  const columnId = uuid(form, 'columnId');
  const name = field(form, 'name');
  const expectedVersion = version(form);
  if (!boardId || !columnId) redirect('/app');
  const path = `/app/boards/${boardId}`;
  if (!name || !expectedVersion) redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/boards/${boardId}/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, expectedVersion }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function removeColumn(form: FormData) {
  const boardId = uuid(form, 'boardId');
  const columnId = uuid(form, 'columnId');
  const expectedVersion = version(form);
  if (!boardId || !columnId) redirect('/app');
  const path = `/app/boards/${boardId}`;
  if (!expectedVersion) redirect(`${path}?error=invalid`);
  try {
    await apiRequest(`/boards/${boardId}/columns/${columnId}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}

export async function moveColumn(form: FormData) {
  const boardId = uuid(form, 'boardId');
  const columnId = uuid(form, 'columnId');
  const direction = String(form.get('direction') ?? '');
  const expectedVersion = version(form);
  if (!boardId || !columnId) redirect('/app');
  const path = `/app/boards/${boardId}`;
  if (!expectedVersion || !['left', 'right'].includes(direction))
    redirect(`${path}?error=invalid`);
  let board: Board;
  try {
    board = await apiRequest<Board>(`/boards/${boardId}`);
  } catch (error) {
    fail(error, path);
  }
  if (board.version !== expectedVersion) redirect(`${path}?error=conflict`);
  const columnIds = board.columns.map((column) => column.id);
  const position = columnIds.indexOf(columnId);
  const next = position + (direction === 'left' ? -1 : 1);
  if (position < 0 || next < 0 || next >= columnIds.length)
    redirect(`${path}?error=invalid`);
  [columnIds[position], columnIds[next]] = [
    columnIds[next],
    columnIds[position],
  ];
  try {
    await apiRequest(`/boards/${boardId}/columns/order`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, columnIds }),
    });
  } catch (error) {
    fail(error, path);
  }
  revalidatePath(path);
  redirect(`${path}?updated=1`);
}
