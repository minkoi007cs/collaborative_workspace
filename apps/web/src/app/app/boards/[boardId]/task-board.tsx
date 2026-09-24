'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { BoardColumn, Task } from '@/lib/api/types';
import { browserClient } from '@/lib/supabase/browser';
import { moveTaskOnBoard } from '../../task-actions';

type BoardTasksContext = {
  columns: BoardColumn[];
  tasks: Task[];
  canEdit: boolean;
  pending: boolean;
  move: (
    taskId: string,
    toColumnId: string,
    beforeTaskId: string | null,
  ) => Promise<void>;
};
const Context = createContext<BoardTasksContext | null>(null);

function useBoardTasks() {
  const value = useContext(Context);
  if (!value) throw new Error('Task board provider missing');
  return value;
}

export function TaskBoardProvider({
  boardId,
  workspaceId,
  columns,
  initialTasks,
  canEdit,
  children,
}: {
  boardId: string;
  workspaceId: string;
  columns: BoardColumn[];
  initialTasks: Task[];
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState<
    'connecting' | 'connected' | 'unavailable'
  >('connecting');
  const [online, setOnline] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [presenceAvailable, setPresenceAvailable] = useState(true);
  const pendingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!pendingRef.current) setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setLiveStatus('unavailable');
      return;
    }
    const socket = io(`${new URL(apiUrl).origin}/realtime`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: (callback) => {
        try {
          browserClient()
            .auth.getSession()
            .then(({ data }) =>
              callback({ token: data.session?.access_token ?? '' }),
            )
            .catch(() => callback({ token: '' }));
        } catch {
          callback({ token: '' });
        }
      },
    });
    const seen = new Set<string>();
    const refresh = (event?: { eventId?: string; boardId?: string }) => {
      if (event && event.boardId !== boardId) return;
      if (event?.eventId) {
        if (seen.has(event.eventId)) return;
        seen.add(event.eventId);
        if (seen.size > 100) seen.delete(seen.values().next().value as string);
      }
      if (!pendingRef.current) router.refresh();
    };
    socket.on('connect', () => {
      socket.timeout(5000).emit(
        'board.join',
        { boardId },
        (
          timeout: Error | null,
          result?: {
            ok: boolean;
            presence?: Array<{ id: string; displayName: string }>;
            presenceAvailable?: boolean;
          },
        ) => {
          if (timeout || !result?.ok) {
            setLiveStatus('unavailable');
            socket.disconnect();
            router.refresh();
            return;
          }
          setLiveStatus('connected');
          setOnline(result.presence ?? []);
          setPresenceAvailable(result.presenceAvailable !== false);
          refresh();
        },
      );
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      setLiveStatus('connecting');
      setOnline([]);
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.on('connect_error', () => setLiveStatus('unavailable'));
    socket.on(
      'presence.online',
      (event: {
        workspaceId: string;
        entityId: string;
        payload?: { displayName?: string };
      }) => {
        if (event.workspaceId !== workspaceId) return;
        setOnline((current) =>
          current.some((entry) => entry.id === event.entityId)
            ? current
            : [
                ...current,
                {
                  id: event.entityId,
                  displayName: event.payload?.displayName ?? 'Member',
                },
              ],
        );
      },
    );
    socket.on(
      'presence.offline',
      (event: { workspaceId: string; entityId: string }) => {
        if (event.workspaceId === workspaceId)
          setOnline((current) =>
            current.filter((entry) => entry.id !== event.entityId),
          );
      },
    );
    for (const name of [
      'task.created',
      'task.updated',
      'task.moved',
      'task.deleted',
      'board.updated',
    ]) {
      socket.on(name, refresh);
    }
    const heartbeat = setInterval(() => {
      if (socket.connected)
        socket.timeout(5000).emit(
          'presence.heartbeat',
          (
            timeout: Error | null,
            result?: {
              ok: boolean;
              presence?: Array<{ id: string; displayName: string }>;
            },
          ) => {
            if (timeout || !result?.ok) {
              setPresenceAvailable(false);
              return;
            }
            setPresenceAvailable(true);
            if (result.presence) setOnline(result.presence);
          },
        );
    }, 30_000);
    socket.connect();
    return () => {
      clearInterval(heartbeat);
      socket.disconnect();
    };
  }, [boardId, workspaceId, router]);

  async function move(
    taskId: string,
    toColumnId: string,
    beforeTaskId: string | null,
  ) {
    if (!canEdit || pending) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !columns.some((column) => column.id === toColumnId)) return;
    if (beforeTaskId === taskId) return;
    const before = beforeTaskId
      ? tasks.find((item) => item.id === beforeTaskId)
      : null;
    if (beforeTaskId && before?.columnId !== toColumnId) return;
    const previous = tasks;
    const remaining = tasks.filter((item) => item.id !== taskId);
    let index = beforeTaskId
      ? remaining.findIndex((item) => item.id === beforeTaskId)
      : -1;
    if (index < 0) {
      const lastInColumn = remaining.findLastIndex(
        (item) => item.columnId === toColumnId,
      );
      index = lastInColumn < 0 ? remaining.length : lastInColumn + 1;
    }
    remaining.splice(index, 0, { ...task, columnId: toColumnId });
    setTasks(remaining);
    pendingRef.current = true;
    setPending(true);
    setError('');
    let result: Awaited<ReturnType<typeof moveTaskOnBoard>>;
    try {
      result = await moveTaskOnBoard({
        taskId,
        expectedVersion: task.version,
        toColumnId,
        beforeTaskId,
      });
    } catch {
      pendingRef.current = false;
      setPending(false);
      setTasks(previous);
      setError('Could not connect to the server. Try again.');
      router.refresh();
      return;
    }
    pendingRef.current = false;
    setPending(false);
    if (result.error) {
      setTasks(previous);
      if (result.error === 'unauthenticated') {
        router.push('/login');
        return;
      }
      setError(
        result.error === 'conflict'
          ? 'Another edit changed this task. Refresh the board to review it.'
          : 'Could not move this task. Try again.',
      );
      router.refresh();
      return;
    }
    if (result.task)
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId ? (result.task as Task) : item,
        ),
      );
    router.refresh();
  }

  return (
    <Context.Provider value={{ columns, tasks, canEdit, pending, move }}>
      {canEdit && (
        <p className="board-hint">
          Drag a task onto a column or another task to move it. Use the arrow
          buttons for keyboard access.
        </p>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <p className="board-hint" role="status">
        {liveStatus === 'connected'
          ? 'Live updates on'
          : liveStatus === 'connecting'
            ? 'Connecting live updates…'
            : 'Live updates unavailable. Refresh to see new changes.'}
      </p>
      {liveStatus === 'connected' && (
        <p className="board-hint" aria-live="polite">
          {presenceAvailable
            ? `Online now: ${online.length ? online.map((member) => member.displayName).join(', ') : 'No members'}`
            : 'Online status unavailable'}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}

export function TaskColumn({ columnId }: { columnId: string }) {
  const { columns, tasks, canEdit, pending, move } = useBoardTasks();
  const columnIndex = columns.findIndex((column) => column.id === columnId);
  const visible = tasks.filter((task) => task.columnId === columnId);

  function dragId(event: React.DragEvent) {
    return event.dataTransfer.getData('text/plain');
  }

  return (
    <section
      className="task-list"
      aria-label={`${columns[columnIndex]?.name ?? 'Column'} tasks`}
      onDragOver={canEdit ? (event) => event.preventDefault() : undefined}
      onDrop={
        canEdit
          ? (event) => {
              event.preventDefault();
              void move(dragId(event), columnId, null);
            }
          : undefined
      }
    >
      {visible.map((task) => (
        <article
          className="task-card-wrap"
          key={task.id}
          aria-label={`Task ${task.title}`}
          onDragOver={canEdit ? (event) => event.preventDefault() : undefined}
          onDrop={
            canEdit
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void move(dragId(event), columnId, task.id);
                }
              : undefined
          }
        >
          <Link
            className="task-card"
            href={`/app/tasks/${task.id}`}
            draggable={canEdit && !pending}
            onDragStart={
              canEdit
                ? (event) => event.dataTransfer.setData('text/plain', task.id)
                : undefined
            }
          >
            <strong className={task.completedAt ? 'task-done' : undefined}>
              {task.title}
            </strong>
            <span className="task-meta">
              {task.priority !== 'NONE' && (
                <span className="role-badge">
                  {task.priority.toLowerCase()}
                </span>
              )}
              {task.dueAt && <span>Due {task.dueAt.slice(0, 10)}</span>}
              {task.assignees.length > 0 && (
                <span>
                  {task.assignees
                    .map((entry) => entry.user.displayName)
                    .join(', ')}
                </span>
              )}
            </span>
            {task.labels.length > 0 && (
              <span className="task-labels">
                {task.labels.map((entry) => (
                  <span
                    key={entry.label.id}
                    className="task-label"
                    style={{ borderColor: entry.label.color }}
                  >
                    {entry.label.name}
                  </span>
                ))}
              </span>
            )}
          </Link>
          {canEdit && (
            <div className="task-quick-move">
              <button
                type="button"
                className="text-button"
                disabled={pending || columnIndex <= 0}
                onClick={() =>
                  void move(task.id, columns[columnIndex - 1].id, null)
                }
                aria-label={`Move ${task.title} to previous column`}
              >
                ←
              </button>
              <button
                type="button"
                className="text-button"
                disabled={pending || columnIndex >= columns.length - 1}
                onClick={() =>
                  void move(task.id, columns[columnIndex + 1].id, null)
                }
                aria-label={`Move ${task.title} to next column`}
              >
                →
              </button>
            </div>
          )}
        </article>
      ))}
      {visible.length === 0 && (
        <p className="column-empty">No tasks in this column yet.</p>
      )}
    </section>
  );
}
