import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type {
  Board,
  Member,
  Profile,
  Project,
  Task,
  TaskPage,
} from '@/lib/api/types';
import {
  addColumn,
  moveColumn,
  removeColumn,
  renameColumn,
} from '../../project-actions';
import { SignOutButton } from '../../sign-out-button';
import { createTask } from '../../task-actions';
import { ConfirmButton } from '../../workspaces/[workspaceId]/confirm-button';
import { TaskBoardProvider, TaskColumn } from './task-board';

export const dynamic = 'force-dynamic';

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ error?: string; updated?: string; pages?: string }>;
}) {
  const { boardId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) notFound();
  const notices = await searchParams;
  let board: Board;
  let project: Project;
  try {
    board = await apiRequest<Board>(`/boards/${boardId}`);
    project = await apiRequest<Project>(`/projects/${board.projectId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main">
        <h1>Board unavailable</h1>
        <p>Check the API and try again.</p>
        <Link href="/app">All workspaces</Link>
      </main>
    );
  }
  let members: Member[];
  let profile: Profile;
  let taskPage: TaskPage;
  try {
    [members, profile, taskPage] = await Promise.all([
      apiRequest<Member[]>(`/workspaces/${project.workspaceId}/members`),
      apiRequest<Profile>('/users/me'),
      apiRequest<TaskPage>(`/boards/${boardId}/tasks`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    return (
      <main className="main">
        <h1>Board unavailable</h1>
        <p>Check the API and try again.</p>
      </main>
    );
  }
  const requestedPages = Math.min(Math.max(Number(notices.pages) || 1, 1), 10);
  const tasks: Task[] = [...taskPage.items];
  let nextCursor = taskPage.nextCursor;
  for (let page = 1; page < requestedPages && nextCursor; page++) {
    try {
      const next = await apiRequest<TaskPage>(
        `/boards/${boardId}/tasks?cursor=${nextCursor}`,
      );
      tasks.push(...next.items);
      nextCursor = next.nextCursor;
    } catch {
      return (
        <main className="main">
          <h1>Board unavailable</h1>
          <p>Could not load the rest of this board. Try again.</p>
        </main>
      );
    }
  }
  const role = members.find((member) => member.user.id === profile.id)?.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const canEdit = role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR';
  const projectPath = `/app/projects/${project.id}`;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Board navigation">
        <Link href="/app" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Board</div>
        <span className="sidebar-item" aria-current="page">
          {board.name}
        </span>
        <Link className="sidebar-note" href={projectPath}>
          ← {project.name}
        </Link>
      </aside>
      <main className="main">
        <Link href={projectPath} className="back-link">
          ← {project.name}
        </Link>
        <div className="dashboard-top">
          <div>
            <p className="topline">Board · {role?.toLowerCase()}</p>
            <h1>{board.name}</h1>
            <p className="lede">
              Organize and track your team’s work by stage.
            </p>
          </div>
          <SignOutButton />
        </div>
        {notices.updated && (
          <p className="success-message" role="status">
            Board updated.
          </p>
        )}
        {notices.error === 'conflict' && (
          <p className="form-message" role="alert">
            This board changed while you were editing. Refresh the page and try
            again.
          </p>
        )}
        {notices.error === 'column-occupied' && (
          <p className="form-message" role="alert">
            Move or delete tasks before removing this column. If the board
            changed, refresh and try again.
          </p>
        )}
        {notices.error &&
          !['conflict', 'column-occupied'].includes(notices.error) && (
            <p className="form-message" role="alert">
              Could not save that change. Refresh and try again.
            </p>
          )}
        <TaskBoardProvider
          boardId={boardId}
          columns={board.columns}
          initialTasks={tasks}
          canEdit={canEdit}
        >
          <section className="board-grid" aria-label="Board columns">
            {board.columns.map((column, index) => (
              <article className="board-column" key={column.id}>
                <div className="board-column-top">
                  <h2>{column.name}</h2>
                  <span className="role-badge">{index + 1}</span>
                </div>
                <TaskColumn columnId={column.id} />
                {canEdit && (
                  <form action={createTask} className="inline-form task-create">
                    <input type="hidden" name="boardId" value={boardId} />
                    <input type="hidden" name="columnId" value={column.id} />
                    <label htmlFor={`new-task-${column.id}`}>New task</label>
                    <input
                      id={`new-task-${column.id}`}
                      name="title"
                      placeholder="What needs to be done?"
                      maxLength={200}
                      required
                    />
                    <button type="submit" className="secondary-button">
                      Add task
                    </button>
                  </form>
                )}
                {canManage && (
                  <div className="column-actions">
                    <div className="column-move">
                      <form action={moveColumn}>
                        <input type="hidden" name="boardId" value={boardId} />
                        <input
                          type="hidden"
                          name="columnId"
                          value={column.id}
                        />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={board.version}
                        />
                        <input type="hidden" name="direction" value="left" />
                        <button
                          className="text-button"
                          type="submit"
                          disabled={index === 0}
                          aria-label={`Move ${column.name} left`}
                        >
                          ← Left
                        </button>
                      </form>
                      <form action={moveColumn}>
                        <input type="hidden" name="boardId" value={boardId} />
                        <input
                          type="hidden"
                          name="columnId"
                          value={column.id}
                        />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={board.version}
                        />
                        <input type="hidden" name="direction" value="right" />
                        <button
                          className="text-button"
                          type="submit"
                          disabled={index === board.columns.length - 1}
                          aria-label={`Move ${column.name} right`}
                        >
                          Right →
                        </button>
                      </form>
                    </div>
                    <form action={renameColumn} className="inline-form">
                      <input type="hidden" name="boardId" value={boardId} />
                      <input type="hidden" name="columnId" value={column.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={board.version}
                      />
                      <label htmlFor={`column-${column.id}`}>
                        Rename column
                      </label>
                      <input
                        id={`column-${column.id}`}
                        name="name"
                        defaultValue={column.name}
                        maxLength={100}
                        required
                      />
                      <button type="submit" className="secondary-button">
                        Save
                      </button>
                    </form>
                    <form action={removeColumn}>
                      <input type="hidden" name="boardId" value={boardId} />
                      <input type="hidden" name="columnId" value={column.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={board.version}
                      />
                      <ConfirmButton
                        className="danger-button"
                        message={`Remove ${column.name}?`}
                      >
                        Remove column
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </article>
            ))}
            {canManage && (
              <div className="board-column new-column">
                <h2>Add a column</h2>
                <form action={addColumn} className="inline-form">
                  <input type="hidden" name="boardId" value={boardId} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={board.version}
                  />
                  <label htmlFor="new-column-name">Name</label>
                  <input
                    id="new-column-name"
                    name="name"
                    placeholder="Review"
                    maxLength={100}
                    required
                  />
                  <button type="submit" className="primary-button">
                    Add column
                  </button>
                </form>
              </div>
            )}
          </section>
        </TaskBoardProvider>
        {nextCursor && (
          <p className="board-more">
            Showing {tasks.length} tasks.{' '}
            {requestedPages < 10 ? (
              <Link href={`/app/boards/${boardId}?pages=${requestedPages + 1}`}>
                Load more tasks
              </Link>
            ) : (
              'This board has more tasks; narrow it down in a later search milestone.'
            )}
          </p>
        )}
      </main>
    </div>
  );
}
