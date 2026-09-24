import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type {
  Member,
  Project,
  TaskSearchPage,
  Workspace,
} from '@/lib/api/types';

export const dynamic = 'force-dynamic';

export default async function WorkspaceSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    projectId?: string;
    assigneeId?: string;
    priority?: string;
  }>;
}) {
  const { workspaceId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      workspaceId,
    )
  )
    notFound();
  const input = await searchParams;
  const q = String(input.q ?? '')
    .trim()
    .slice(0, 100);
  const page = Math.min(Math.max(Number(input.page) || 1, 1), 10);
  let workspace: Workspace;
  let projects: Project[];
  let members: Member[];
  try {
    [workspace, projects, members] = await Promise.all([
      apiRequest<Workspace>(`/workspaces/${workspaceId}`),
      apiRequest<Project[]>(`/workspaces/${workspaceId}/projects`),
      apiRequest<Member[]>(`/workspaces/${workspaceId}/members`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main">
        <h1>Search unavailable</h1>
        <p>Try again later.</p>
      </main>
    );
  }
  const projectId = projects.some((project) => project.id === input.projectId)
    ? input.projectId
    : '';
  const assigneeId = members.some(
    (member) => member.user.id === input.assigneeId,
  )
    ? input.assigneeId
    : '';
  const priorities = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const priority = priorities.includes(input.priority ?? '')
    ? input.priority
    : '';
  const query = new URLSearchParams({ q, page: String(page) });
  if (projectId) query.set('projectId', projectId);
  if (assigneeId) query.set('assigneeId', assigneeId);
  if (priority) query.set('priority', priority);
  let results: TaskSearchPage | null = null;
  let unavailable = false;
  if (q.length >= 2) {
    try {
      results = await apiRequest<TaskSearchPage>(
        `/workspaces/${workspaceId}/search?${query.toString()}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirect('/login');
      if (error instanceof ApiError && error.status === 404) notFound();
      unavailable = true;
    }
  }
  const next = new URLSearchParams(query);
  next.set('page', String(page + 1));
  const previous = new URLSearchParams(query);
  previous.set('page', String(page - 1));
  return (
    <main className="main search-page">
      <Link href={`/app/workspaces/${workspaceId}`} className="back-link">
        ← {workspace.name}
      </Link>
      <p className="topline">Workspace search</p>
      <h1>Find a task</h1>
      <form method="get" className="banner search-form">
        <label htmlFor="search-query">Search titles and descriptions</label>
        <input
          id="search-query"
          name="q"
          defaultValue={q}
          minLength={2}
          maxLength={100}
          required
        />
        <div className="search-filters">
          <div>
            <label htmlFor="search-project">Project</label>
            <select
              id="search-project"
              name="projectId"
              defaultValue={projectId}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-assignee">Assignee</label>
            <select
              id="search-assignee"
              name="assigneeId"
              defaultValue={assigneeId}
            >
              <option value="">Anyone</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-priority">Priority</label>
            <select
              id="search-priority"
              name="priority"
              defaultValue={priority}
            >
              <option value="">Any priority</option>
              {priorities.map((value) => (
                <option key={value} value={value}>
                  {value.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="primary-button" type="submit">
          Search tasks
        </button>
      </form>
      {q.length === 1 && <p role="alert">Enter at least two characters.</p>}
      {unavailable && <p role="alert">Search is temporarily unavailable.</p>}
      {results && (
        <section className="banner" aria-label="Search results">
          <h2>Results</h2>
          {results.items.length === 0 ? (
            <p>No matching tasks in this workspace.</p>
          ) : (
            <ul className="simple-list">
              {results.items.map((item) => (
                <li key={item.taskId}>
                  <Link href={`/app/tasks/${item.taskId}`}>
                    <strong>{item.title}</strong>
                  </Link>
                  <p>
                    {item.projectName} · {item.boardName} ·{' '}
                    {item.priority.toLowerCase()}
                  </p>
                  {item.description && <p>{item.description.slice(0, 180)}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="search-pagination">
            {page > 1 && <Link href={`?${previous.toString()}`}>Previous</Link>}
            <span>Page {page}</span>
            {results.hasMore && page < 10 && (
              <Link href={`?${next.toString()}`}>Next</Link>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
