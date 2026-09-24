import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type {
  ActivityEvent,
  ActivityPage,
  Invitation,
  Member,
  Profile,
  Project,
  Workspace,
} from '@/lib/api/types';
import { SignOutButton } from '../../sign-out-button';
import { ActivityFeed } from '../../activity-feed';
import { createProject } from '../../project-actions';
import {
  archiveWorkspace,
  changeMemberRole,
  renameWorkspace,
  transferOwnership,
} from '../../workspace-actions';
import { ConfirmButton } from './confirm-button';
import { InviteForm } from './invite-form';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    error?: string;
    updated?: string;
    joined?: string;
    activityPages?: string;
  }>;
}) {
  const { workspaceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) notFound();
  const notices = await searchParams;
  let workspace: Workspace;
  let members: Member[];
  let profile: Profile;
  let projects: Project[];
  try {
    [workspace, members, profile, projects] = await Promise.all([
      apiRequest<Workspace>(`/workspaces/${workspaceId}`),
      apiRequest<Member[]>(`/workspaces/${workspaceId}/members`),
      apiRequest<Profile>('/users/me'),
      apiRequest<Project[]>(`/workspaces/${workspaceId}/projects`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main">
        <h1>Workspace unavailable</h1>
        <p>We could not load this workspace. Check the API and try again.</p>
        <Link href="/app">Back to your account</Link>
      </main>
    );
  }
  const role =
    members.find((member) => member.user.id === profile.id)?.role ?? 'VIEWER';
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const pendingInvitations = canManage
    ? await apiRequest<Invitation[]>(
        `/workspaces/${workspaceId}/invitations`,
      ).catch(() => [])
    : [];
  const activityPages = Math.min(
    Math.max(Number(notices.activityPages) || 1, 1),
    10,
  );
  const activity: ActivityEvent[] = [];
  let nextActivityCursor: string | null = null;
  let activityUnavailable = false;
  try {
    const first = await apiRequest<ActivityPage>(
      `/workspaces/${workspaceId}/activity`,
    );
    activity.push(...first.items);
    nextActivityCursor = first.nextCursor;
    for (let page = 1; page < activityPages && nextActivityCursor; page++) {
      const next: ActivityPage = await apiRequest<ActivityPage>(
        `/workspaces/${workspaceId}/activity?cursor=${nextActivityCursor}`,
      );
      activity.push(...next.items);
      nextActivityCursor = next.nextCursor;
    }
  } catch {
    activityUnavailable = true;
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <Link href="/app" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Workspace</div>
        <span className="sidebar-item" aria-current="page">
          {workspace.name}
        </span>
        <Link className="sidebar-note" href="/app">
          ← All workspaces
        </Link>
      </aside>
      <main className="main">
        <Link href="/app" className="back-link">
          ← All workspaces
        </Link>
        <div className="dashboard-top">
          <div>
            <p className="topline">
              {role.toLowerCase()} · {workspace._count.members}{' '}
              {workspace._count.members === 1 ? 'member' : 'members'}
            </p>
            <h1>{workspace.name}</h1>
            <p className="lede">
              Organize your team’s work into projects and boards.
            </p>
          </div>
          <SignOutButton />
        </div>
        {notices.updated && (
          <p className="success-message" role="status">
            Workspace updated.
          </p>
        )}
        {notices.joined && (
          <p className="success-message" role="status">
            You joined the workspace.
          </p>
        )}
        {notices.error && (
          <p className="form-message" role="alert">
            That change could not be saved. Please refresh and try again.
          </p>
        )}
        <section className="banner" aria-labelledby="projects-title">
          <h2 id="projects-title">Projects</h2>
          {projects.length === 0 ? (
            <div className="empty-state">
              <strong>No projects yet</strong>
              <p>Create a project to give your team a shared board.</p>
            </div>
          ) : (
            <ul className="workspace-list">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    className="workspace-link"
                    href={`/app/projects/${project.id}`}
                  >
                    <span className="workspace-initial" aria-hidden="true">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>
                        {project.boards.length}{' '}
                        {project.boards.length === 1 ? 'board' : 'boards'}
                        {project.description ? ` · ${project.description}` : ''}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <form
              action={createProject}
              className="inline-form create-workspace"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <label htmlFor="project-name">New project</label>
              <input
                id="project-name"
                name="name"
                placeholder="Product launch"
                maxLength={100}
                required
              />
              <label htmlFor="project-description">
                Description (optional)
              </label>
              <input
                id="project-description"
                name="description"
                placeholder="What is this project for?"
                maxLength={2000}
              />
              <button className="primary-button" type="submit">
                Create project
              </button>
            </form>
          )}
        </section>
        <div className="workspace-grid">
          <section
            className="banner workspace-section"
            aria-labelledby="members-title"
          >
            <h2 id="members-title">Members</h2>
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <div className="member-avatar" aria-hidden="true">
                    {member.user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong>{member.user.displayName}</strong>
                    <p>{member.user.email}</p>
                  </div>
                  <span className="role-badge">
                    {member.role.toLowerCase()}
                  </span>
                  {role === 'OWNER' && member.role !== 'OWNER' && (
                    <form
                      action={changeMemberRole}
                      className="member-role-form"
                    >
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input type="hidden" name="memberId" value={member.id} />
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.user.displayName}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        name="role"
                        defaultValue={member.role}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <button type="submit" className="text-button">
                        Save
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section
            className="banner workspace-section"
            aria-labelledby="settings-title"
          >
            <h2 id="settings-title">Workspace settings</h2>
            {canManage ? (
              <form action={renameWorkspace} className="inline-form">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <label htmlFor="workspace-name">Name</label>
                <input
                  id="workspace-name"
                  name="name"
                  defaultValue={workspace.name}
                  maxLength={100}
                  required
                />
                <button className="secondary-button" type="submit">
                  Rename workspace
                </button>
              </form>
            ) : (
              <p>Ask an admin to update this workspace.</p>
            )}
            {role === 'OWNER' && (
              <>
                <form
                  action={transferOwnership}
                  className="inline-form action-divider"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <label htmlFor="new-owner">Transfer ownership</label>
                  <select
                    id="new-owner"
                    name="memberId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a member
                    </option>
                    {members
                      .filter((member) => member.role !== 'OWNER')
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.displayName}
                        </option>
                      ))}
                  </select>
                  <ConfirmButton message="Transfer ownership to this member? You will become an admin.">
                    Transfer ownership
                  </ConfirmButton>
                </form>
                <form action={archiveWorkspace} className="action-divider">
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <ConfirmButton
                    message="Archive this workspace? Members will lose access until it is restored."
                    className="danger-button"
                  >
                    Archive workspace
                  </ConfirmButton>
                </form>
              </>
            )}
          </section>
        </div>
        {canManage && (
          <section className="banner">
            <InviteForm
              workspaceId={workspaceId}
              canInviteAdmin={role === 'OWNER'}
            />
            {pendingInvitations.length > 0 && (
              <div className="action-divider">
                <h3>Pending invitations</h3>
                <ul className="simple-list">
                  {pendingInvitations.map((invitation) => (
                    <li key={invitation.id}>
                      {invitation.email} · {invitation.role.toLowerCase()} ·
                      expires{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        <ActivityFeed
          title="Workspace activity"
          events={activity}
          unavailable={activityUnavailable}
          moreHref={
            nextActivityCursor && activityPages < 10
              ? `/app/workspaces/${workspaceId}?activityPages=${activityPages + 1}`
              : undefined
          }
        />
      </main>
    </div>
  );
}
