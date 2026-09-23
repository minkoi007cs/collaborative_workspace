'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { Workspace } from '@/lib/api/types';

function textField(form: FormData, name: string, max: number) {
  const value = String(form.get(name) ?? '').trim();
  return value.length > 0 && value.length <= max ? value : null;
}

function uuidField(form: FormData, name: string) {
  const value = String(form.get(name) ?? '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

function redirectIfUnauthenticated(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) redirect('/login');
}

export async function createWorkspace(form: FormData) {
  const name = textField(form, 'name', 100);
  if (!name) redirect('/app?workspaceError=invalid');
  let workspace: Workspace;
  try {
    workspace = await apiRequest<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  } catch (error) {
    redirectIfUnauthenticated(error);
    redirect('/app?workspaceError=save');
  }
  revalidatePath('/app');
  redirect(`/app/workspaces/${workspace.id}`);
}

export async function renameWorkspace(form: FormData) {
  const workspaceId = uuidField(form, 'workspaceId');
  const name = textField(form, 'name', 100);
  if (!workspaceId || !name) redirect('/app');
  try {
    await apiRequest(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  } catch (error) {
    redirectIfUnauthenticated(error);
    redirect(`/app/workspaces/${workspaceId}?error=save`);
  }
  revalidatePath(`/app/workspaces/${workspaceId}`);
  redirect(`/app/workspaces/${workspaceId}?updated=1`);
}

export async function archiveWorkspace(form: FormData) {
  const workspaceId = uuidField(form, 'workspaceId');
  if (!workspaceId) redirect('/app');
  try {
    await apiRequest(`/workspaces/${workspaceId}`, { method: 'DELETE' });
  } catch (error) {
    redirectIfUnauthenticated(error);
    redirect(`/app/workspaces/${workspaceId}?error=archive`);
  }
  revalidatePath('/app');
  redirect('/app?archived=1');
}

export async function changeMemberRole(form: FormData) {
  const workspaceId = uuidField(form, 'workspaceId');
  const memberId = uuidField(form, 'memberId');
  const role = String(form.get('role') ?? '');
  if (
    !workspaceId ||
    !memberId ||
    !['ADMIN', 'EDITOR', 'VIEWER'].includes(role)
  )
    redirect('/app');
  try {
    await apiRequest(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  } catch (error) {
    redirectIfUnauthenticated(error);
    redirect(`/app/workspaces/${workspaceId}?error=role`);
  }
  revalidatePath(`/app/workspaces/${workspaceId}`);
  redirect(`/app/workspaces/${workspaceId}?updated=1`);
}

export async function transferOwnership(form: FormData) {
  const workspaceId = uuidField(form, 'workspaceId');
  const memberId = uuidField(form, 'memberId');
  if (!workspaceId || !memberId) redirect('/app');
  try {
    await apiRequest(`/workspaces/${workspaceId}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  } catch (error) {
    redirectIfUnauthenticated(error);
    redirect(`/app/workspaces/${workspaceId}?error=transfer`);
  }
  revalidatePath(`/app/workspaces/${workspaceId}`);
  redirect(`/app/workspaces/${workspaceId}?updated=1`);
}

export type InviteState = { link: string; error: string };

export async function createInvitation(
  _previous: InviteState,
  form: FormData,
): Promise<InviteState> {
  const workspaceId = uuidField(form, 'workspaceId');
  const email = textField(form, 'email', 320)?.toLowerCase();
  const role = String(form.get('role') ?? '');
  if (
    !workspaceId ||
    !email ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !['ADMIN', 'EDITOR', 'VIEWER'].includes(role)
  ) {
    return { link: '', error: 'Enter a valid email and role.' };
  }
  try {
    const result = await apiRequest<{ token: string }>(
      `/workspaces/${workspaceId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      },
    );
    revalidatePath(`/app/workspaces/${workspaceId}`);
    return { link: `/invite/${result.token}`, error: '' };
  } catch (error) {
    redirectIfUnauthenticated(error);
    return {
      link: '',
      error:
        error instanceof ApiError && error.status === 403
          ? 'Your role cannot invite this member.'
          : 'Could not create invitation.',
    };
  }
}

export async function acceptInvitation(form: FormData) {
  const token = textField(form, 'token', 43);
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token))
    redirect('/app?inviteError=invalid');
  let workspace: Workspace;
  try {
    workspace = await apiRequest<Workspace>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    redirectIfUnauthenticated(error);
    const code =
      error instanceof ApiError && error.status === 403 ? 'email' : 'invalid';
    redirect(`/app?inviteError=${code}`);
  }
  revalidatePath('/app');
  redirect(`/app/workspaces/${workspace.id}?joined=1`);
}
