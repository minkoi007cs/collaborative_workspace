import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { NotificationCount, Profile, Workspace } from '@/lib/api/types';
import { verifiedAccessToken } from '@/lib/supabase/access-token';
import { updateProfile } from './actions';
import { SignOutButton } from './sign-out-button';
import { createWorkspace } from './workspace-actions';

export const dynamic = 'force-dynamic';

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    updated?: string;
    workspaceError?: string;
    archived?: string;
    inviteError?: string;
  }>;
}) {
  if (!(await verifiedAccessToken())) redirect('/login');
  const params = await searchParams;
  const [profileResult, workspacesResult, notificationResult] =
    await Promise.allSettled([
      apiRequest<Profile>('/users/me'),
      apiRequest<Workspace[]>('/workspaces'),
      apiRequest<NotificationCount>('/notifications/unread-count'),
    ]);
  if (
    [profileResult, workspacesResult, notificationResult].some(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ApiError &&
        result.reason.status === 401,
    )
  )
    redirect('/login');
  const profile =
    profileResult.status === 'fulfilled' ? profileResult.value : null;
  const workspaces =
    workspacesResult.status === 'fulfilled' ? workspacesResult.value : null;
  const notificationCount =
    notificationResult.status === 'fulfilled'
      ? notificationResult.value.unreadCount
      : null;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <Link href="/" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Your space</div>
        <span className="sidebar-item" aria-current="page">
          Workspaces
        </span>
        <Link href="/app/notifications" className="sidebar-item">
          Notifications
          {notificationCount === null ? '' : ` (${notificationCount})`}
        </Link>
      </aside>
      <main className="main">
        <div className="dashboard-top">
          <div>
            <p className="topline">Your account</p>
            <h1>
              {profile
                ? `Welcome, ${profile.displayName}`
                : 'Welcome to SyncSpace'}
            </h1>
            <p className="lede">
              A home for your team’s shared work. Create a workspace and invite
              your collaborators.
            </p>
          </div>
          <SignOutButton />
        </div>
        {params.archived && (
          <p className="success-message" role="status">
            Workspace archived.
          </p>
        )}
        {params.inviteError && (
          <p className="form-message" role="alert">
            {params.inviteError === 'email'
              ? 'Sign in with the email address on the invitation.'
              : params.inviteError === 'limited'
                ? 'Too many invitation attempts. Try again in a few minutes.'
                : params.inviteError === 'unavailable'
                  ? 'Invitation service is temporarily unavailable.'
                  : 'This invitation is invalid, expired, or already used.'}
          </p>
        )}
        <section className="banner" aria-labelledby="workspaces-title">
          <div className="section-heading">
            <div>
              <span className="badge">Team spaces</span>
              <h2 id="workspaces-title">Your workspaces</h2>
            </div>
          </div>
          {workspaces === null ? (
            <p role="alert">
              Workspaces could not be loaded. Please refresh after checking the
              API.
            </p>
          ) : workspaces.length === 0 ? (
            <div className="empty-state">
              <strong>No workspaces yet</strong>
              <p>Create one to give your team a shared place to start.</p>
            </div>
          ) : (
            <div className="workspace-list">
              {workspaces.map((workspace) => (
                <Link
                  href={`/app/workspaces/${workspace.id}`}
                  className="workspace-link"
                  key={workspace.id}
                >
                  <span className="workspace-initial" aria-hidden="true">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{workspace.name}</strong>
                    <small>
                      {workspace._count.members}{' '}
                      {workspace._count.members === 1 ? 'member' : 'members'}
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
          {profile && (
            <form
              action={createWorkspace}
              className="inline-form create-workspace"
            >
              <label htmlFor="workspace-name">Create a workspace</label>
              <div className="profile-form-row">
                <input
                  id="workspace-name"
                  name="name"
                  placeholder="e.g. Product team"
                  maxLength={100}
                  required
                />
                <button className="primary-button" type="submit">
                  Create workspace
                </button>
              </div>
            </form>
          )}
          {params.workspaceError && (
            <p className="form-message" role="alert">
              {params.workspaceError === 'invalid'
                ? 'Enter a workspace name between 1 and 100 characters.'
                : 'Could not create the workspace. Please try again.'}
            </p>
          )}
        </section>
        <section
          className="banner profile-panel"
          aria-labelledby="profile-title"
        >
          <h2 id="profile-title">Your profile</h2>
          {!profile ? (
            <p role="alert">
              Profile unavailable. Please check the API and refresh.
            </p>
          ) : (
            <>
              <p className="profile-email">{profile.email}</p>
              <form action={updateProfile} className="profile-form">
                <label htmlFor="displayName">Display name</label>
                <div className="profile-form-row">
                  <input
                    id="displayName"
                    name="displayName"
                    defaultValue={profile.displayName}
                    maxLength={80}
                    required
                  />
                  <button className="secondary-button" type="submit">
                    Save changes
                  </button>
                </div>
              </form>
              {params.updated === '1' && (
                <p className="success-message" role="status">
                  Profile updated.
                </p>
              )}
              {params.error && (
                <p className="form-message" role="alert">
                  {params.error === 'invalid-name'
                    ? 'Enter a name between 1 and 80 characters.'
                    : 'Could not save your profile. Please try again.'}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
