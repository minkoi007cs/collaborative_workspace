import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type {
  Board,
  CommentPage,
  Member,
  Profile,
  Project,
  Task,
  TaskComment,
  TaskLabel,
  TaskPage as TaskListResponse,
} from '@/lib/api/types';
import { SignOutButton } from '../../sign-out-button';
import {
  archiveTask,
  copyTask,
  createTaskLabel,
  deleteTaskPermanent,
  moveTask,
  setTaskAssignees,
  setTaskLabels,
  updateTask,
} from '../../task-actions';
import { ConfirmButton } from '../../workspaces/[workspaceId]/confirm-button';
import { TaskDiscussion } from './task-discussion';

export const dynamic = 'force-dynamic';

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{
    error?: string;
    updated?: string;
    comment?: string;
    commentError?: string;
    commentPages?: string;
  }>;
}) {
  const { taskId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) notFound();
  const notices = await searchParams;
  let task: Task;
  let board: Board;
  let project: Project;
  try {
    task = await apiRequest<Task>(`/tasks/${taskId}`);
    board = await apiRequest<Board>(`/boards/${task.boardId}`);
    project = await apiRequest<Project>(`/projects/${board.projectId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="main">
        <h1>Task unavailable</h1>
        <p>Check the API and try again.</p>
        <Link href="/app">All workspaces</Link>
      </main>
    );
  }
  let members: Member[];
  let profile: Profile;
  let labels: TaskLabel[];
  let firstTasks: TaskListResponse;
  let commentPage: CommentPage;
  try {
    [members, profile, labels, firstTasks, commentPage] = await Promise.all([
      apiRequest<Member[]>(`/workspaces/${project.workspaceId}/members`),
      apiRequest<Profile>('/users/me'),
      apiRequest<TaskLabel[]>(`/projects/${project.id}/labels`),
      apiRequest<TaskListResponse>(`/boards/${board.id}/tasks`),
      apiRequest<CommentPage>(`/tasks/${taskId}/comments`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    return (
      <main className="main">
        <h1>Task unavailable</h1>
        <p>Could not load task details. Try again.</p>
      </main>
    );
  }
  const role = members.find((member) => member.user.id === profile.id)?.role;
  const canEdit = role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR';
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const boardPath = `/app/boards/${board.id}`;
  const currentColumn = board.columns.find(
    (column) => column.id === task.columnId,
  );
  const assignedIds = new Set(
    task.assignees.map((assignee) => assignee.user.id),
  );
  const labelIds = new Set(task.labels.map((entry) => entry.label.id));
  const peers = firstTasks.items.filter(
    (item) => item.columnId === task.columnId && item.id !== taskId,
  );
  const pageCount = Math.min(
    Math.max(Number(notices.commentPages) || 1, 1),
    10,
  );
  const comments: TaskComment[] = [...commentPage.items];
  let nextCommentCursor = commentPage.nextCursor;
  for (let page = 1; page < pageCount && nextCommentCursor; page++) {
    const next = await apiRequest<CommentPage>(
      `/tasks/${taskId}/comments?cursor=${nextCommentCursor}`,
    );
    comments.push(...next.items);
    nextCommentCursor = next.nextCursor;
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Task navigation">
        <Link href="/app" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Task</div>
        <span className="sidebar-item" aria-current="page">
          {task.title}
        </span>
        <Link className="sidebar-note" href={boardPath}>
          ← {board.name}
        </Link>
      </aside>
      <main className="main">
        <Link href={boardPath} className="back-link">
          ← {board.name}
        </Link>
        <div className="dashboard-top">
          <div>
            <p className="topline">
              {project.name} · {currentColumn?.name ?? 'Task'}
            </p>
            <h1>{task.title}</h1>
            <p className="lede">
              {task.completedAt ? 'Completed' : 'Open'} ·{' '}
              {task.priority.toLowerCase()} priority
            </p>
          </div>
          <SignOutButton />
        </div>
        {notices.updated && (
          <p className="success-message" role="status">
            Task updated.
          </p>
        )}
        {notices.error === 'conflict' && (
          <p className="form-message" role="alert">
            Someone changed this task. Refresh the page to review the latest
            version before saving.
          </p>
        )}
        {notices.error && notices.error !== 'conflict' && (
          <p className="form-message" role="alert">
            Could not save this change. Check your input and try again.
          </p>
        )}
        <div
          className="workspace-grid task-layout"
          key={`${task.id}:${task.version}`}
        >
          <section className="banner" aria-labelledby="details-title">
            <h2 id="details-title">Details</h2>
            {canEdit ? (
              <form action={updateTask} className="inline-form">
                <input type="hidden" name="taskId" value={taskId} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={task.version}
                />
                <label htmlFor="task-title">Title</label>
                <input
                  id="task-title"
                  name="title"
                  defaultValue={task.title}
                  maxLength={200}
                  required
                />
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  name="description"
                  defaultValue={task.description ?? ''}
                  maxLength={20000}
                  rows={7}
                  placeholder="Add context for your teammates"
                />
                <label htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  name="priority"
                  defaultValue={task.priority}
                >
                  <option value="NONE">None</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <label htmlFor="task-due">Due date</label>
                <input
                  id="task-due"
                  name="dueDate"
                  type="date"
                  defaultValue={task.dueAt?.slice(0, 10) ?? ''}
                />
                <label className="check-row">
                  <input
                    type="checkbox"
                    name="completed"
                    defaultChecked={Boolean(task.completedAt)}
                  />
                  Completed
                </label>
                <button type="submit" className="primary-button">
                  Save task
                </button>
              </form>
            ) : (
              <div>
                <p>{task.description || 'No description yet.'}</p>
                <p>Due: {task.dueAt?.slice(0, 10) ?? 'None'}</p>
              </div>
            )}
          </section>
          <div>
            <section className="banner" aria-labelledby="assignment-title">
              <h2 id="assignment-title">Assignees</h2>
              {canEdit ? (
                <form action={setTaskAssignees} className="inline-form">
                  <input type="hidden" name="taskId" value={taskId} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={task.version}
                  />
                  <div className="check-list">
                    {members.map((member) => (
                      <label className="check-row" key={member.user.id}>
                        <input
                          type="checkbox"
                          name="userIds"
                          value={member.user.id}
                          defaultChecked={assignedIds.has(member.user.id)}
                        />
                        {member.user.displayName}{' '}
                        <small>{member.user.email}</small>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="secondary-button">
                    Save assignees
                  </button>
                </form>
              ) : (
                <p>
                  {task.assignees
                    .map((item) => item.user.displayName)
                    .join(', ') || 'No assignees'}
                </p>
              )}
            </section>
            <section className="banner" aria-labelledby="labels-title">
              <h2 id="labels-title">Labels</h2>
              {canEdit ? (
                <>
                  <form action={setTaskLabels} className="inline-form">
                    <input type="hidden" name="taskId" value={taskId} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={task.version}
                    />
                    <div className="check-list">
                      {labels.map((label) => (
                        <label className="check-row" key={label.id}>
                          <input
                            type="checkbox"
                            name="labelIds"
                            value={label.id}
                            defaultChecked={labelIds.has(label.id)}
                          />
                          <span
                            className="task-label"
                            style={{ borderColor: label.color }}
                          >
                            {label.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="secondary-button">
                      Save labels
                    </button>
                  </form>
                  <form
                    action={createTaskLabel}
                    className="inline-form action-divider"
                  >
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <label htmlFor="label-name">New label</label>
                    <input
                      id="label-name"
                      name="name"
                      maxLength={50}
                      placeholder="Blocked"
                      required
                    />
                    <label htmlFor="label-color">Color</label>
                    <input
                      id="label-color"
                      name="color"
                      type="color"
                      defaultValue="#7468f8"
                    />
                    <button type="submit" className="text-button">
                      Create label
                    </button>
                  </form>
                </>
              ) : (
                <p>
                  {task.labels.map((entry) => entry.label.name).join(', ') ||
                    'No labels'}
                </p>
              )}
            </section>
            {canEdit && (
              <section className="banner" aria-labelledby="movement-title">
                <h2 id="movement-title">Move task</h2>
                <form action={moveTask} className="inline-form">
                  <input type="hidden" name="taskId" value={taskId} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={task.version}
                  />
                  <label htmlFor="target-column">Column</label>
                  <select
                    id="target-column"
                    name="toColumnId"
                    defaultValue={task.columnId}
                  >
                    {board.columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="secondary-button">
                    Move to end of column
                  </button>
                </form>
                {peers.length > 0 && (
                  <form
                    action={moveTask}
                    className="inline-form action-divider"
                  >
                    <input type="hidden" name="taskId" value={taskId} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={task.version}
                    />
                    <input
                      type="hidden"
                      name="toColumnId"
                      value={task.columnId}
                    />
                    <label htmlFor="before-task">Place before</label>
                    <select id="before-task" name="beforeTaskId">
                      {peers.map((peer) => (
                        <option key={peer.id} value={peer.id}>
                          {peer.title}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-button">
                      Reorder task
                    </button>
                  </form>
                )}
              </section>
            )}
            {canEdit && (
              <section className="banner">
                <form action={copyTask}>
                  <input type="hidden" name="taskId" value={taskId} />
                  <button type="submit" className="secondary-button">
                    Copy task
                  </button>
                </form>
                <form action={archiveTask} className="action-divider">
                  <input type="hidden" name="taskId" value={taskId} />
                  <input type="hidden" name="boardId" value={board.id} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={task.version}
                  />
                  <ConfirmButton
                    className="danger-button"
                    message="Archive this task? It will disappear from the board."
                  >
                    Archive task
                  </ConfirmButton>
                </form>
                {canManage && (
                  <form action={deleteTaskPermanent} className="action-divider">
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="boardId" value={board.id} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={task.version}
                    />
                    <ConfirmButton
                      className="danger-button"
                      message="Permanently delete this task and its assignments and labels?"
                    >
                      Delete permanently
                    </ConfirmButton>
                  </form>
                )}
              </section>
            )}
          </div>
        </div>
        <TaskDiscussion
          taskId={taskId}
          comments={comments}
          members={members}
          currentUserId={profile.id}
          canComment={canEdit}
          more={Boolean(nextCommentCursor) && pageCount < 10}
          pageCount={pageCount}
          notice={notices.comment}
          error={notices.commentError}
        />
      </main>
    </div>
  );
}
