import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { Member, Profile, Project } from '@/lib/api/types';
import { SignOutButton } from '../../sign-out-button';
import {
  archiveProject,
  createBoard,
  updateProject,
} from '../../project-actions';
import { ConfirmButton } from '../../workspaces/[workspaceId]/confirm-button';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { projectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  const notices = await searchParams;
  let project: Project;
  try {
    project = await apiRequest<Project>(`/projects/${projectId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main">
        <h1>Project unavailable</h1>
        <p>Check the API and try again.</p>
        <Link href="/app">All workspaces</Link>
      </main>
    );
  }
  let members: Member[];
  let profile: Profile;
  try {
    [members, profile] = await Promise.all([
      apiRequest<Member[]>(`/workspaces/${project.workspaceId}/members`),
      apiRequest<Profile>('/users/me'),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    return (
      <main className="main">
        <h1>Project unavailable</h1>
        <p>Check the API and try again.</p>
      </main>
    );
  }
  const role = members.find((member) => member.user.id === profile.id)?.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const workspacePath = `/app/workspaces/${project.workspaceId}`;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <Link href="/app" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Project</div>
        <span className="sidebar-item" aria-current="page">
          {project.name}
        </span>
        <Link className="sidebar-note" href={workspacePath}>
          ← Workspace
        </Link>
      </aside>
      <main className="main">
        <Link href={workspacePath} className="back-link">
          ← Workspace
        </Link>
        <div className="dashboard-top">
          <div>
            <p className="topline">Project · {role?.toLowerCase()}</p>
            <h1>{project.name}</h1>
            <p className="lede">
              {project.description ||
                'A shared place for this project’s boards.'}
            </p>
          </div>
          <SignOutButton />
        </div>
        {notices.updated && (
          <p className="success-message" role="status">
            Project updated.
          </p>
        )}
        {notices.error && (
          <p className="form-message" role="alert">
            Could not save that change. Refresh and try again.
          </p>
        )}
        <section className="banner" aria-labelledby="boards-title">
          <h2 id="boards-title">Boards</h2>
          {project.boards.length === 0 ? (
            <div className="empty-state">
              <strong>No boards yet</strong>
              <p>Create one to organize work into columns.</p>
            </div>
          ) : (
            <ul className="workspace-list">
              {project.boards.map((board) => (
                <li key={board.id}>
                  <Link
                    className="workspace-link"
                    href={`/app/boards/${board.id}`}
                  >
                    <span className="workspace-initial" aria-hidden="true">
                      ▦
                    </span>
                    <span>
                      <strong>{board.name}</strong>
                      <small>{board.columns.length} columns</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <form action={createBoard} className="inline-form create-workspace">
              <input type="hidden" name="projectId" value={projectId} />
              <label htmlFor="board-name">New board</label>
              <input
                id="board-name"
                name="name"
                placeholder="Sprint board"
                maxLength={100}
                required
              />
              <button className="primary-button" type="submit">
                Create board
              </button>
            </form>
          )}
        </section>
        {canManage && (
          <section className="banner" aria-labelledby="project-settings">
            <h2 id="project-settings">Project settings</h2>
            <form action={updateProject} className="inline-form">
              <input type="hidden" name="projectId" value={projectId} />
              <label htmlFor="project-name">Name</label>
              <input
                id="project-name"
                name="name"
                defaultValue={project.name}
                maxLength={100}
                required
              />
              <label htmlFor="project-description">Description</label>
              <input
                id="project-description"
                name="description"
                defaultValue={project.description ?? ''}
                maxLength={2000}
              />
              <button type="submit" className="secondary-button">
                Save changes
              </button>
            </form>
            <form action={archiveProject} className="action-divider">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="workspaceId"
                value={project.workspaceId}
              />
              <ConfirmButton
                className="danger-button"
                message="Archive this project? Its boards will no longer be available."
              >
                Archive project
              </ConfirmButton>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
