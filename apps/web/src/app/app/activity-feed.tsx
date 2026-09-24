import Link from 'next/link';
import type { ActivityEvent, BoardColumn } from '@/lib/api/types';

const actions: Record<string, string> = {
  WORKSPACE_CREATED: 'created the workspace',
  WORKSPACE_RENAMED: 'renamed the workspace',
  WORKSPACE_ARCHIVED: 'archived the workspace',
  OWNER_TRANSFERRED: 'transferred ownership',
  MEMBER_INVITED: 'invited a member',
  MEMBER_REMOVED: 'removed a member',
  MEMBER_ROLE_CHANGED: 'changed a member role',
  PROJECT_CREATED: 'created a project',
  PROJECT_ARCHIVED: 'archived a project',
  BOARD_CREATED: 'created a board',
  BOARD_UPDATED: 'updated a board',
  TASK_CREATED: 'created a task',
  TASK_UPDATED: 'updated a task',
  TASK_MOVED: 'moved a task',
  TASK_ASSIGNED: 'changed task assignees',
  TASK_LABELS_CHANGED: 'changed task labels',
  TASK_ARCHIVED: 'archived a task',
  TASK_DELETED: 'deleted a task',
  COMMENT_CREATED: 'commented on a task',
  COMMENT_UPDATED: 'edited a comment',
  COMMENT_DELETED: 'deleted a comment',
};

function details(event: ActivityEvent, columns: BoardColumn[]) {
  const title =
    typeof event.metadata.title === 'string' ? event.metadata.title : null;
  if (event.eventType === 'TASK_MOVED') {
    const from = columns.find(
      (column) => column.id === event.metadata.fromColumnId,
    )?.name;
    const to = columns.find(
      (column) => column.id === event.metadata.toColumnId,
    )?.name;
    if (from && to) return `${title ? `“${title}” · ` : ''}${from} → ${to}`;
  }
  return title ? `“${title}”` : null;
}

export function ActivityFeed({
  title,
  events,
  moreHref,
  unavailable = false,
  columns = [],
}: {
  title: string;
  events: ActivityEvent[];
  moreHref?: string;
  unavailable?: boolean;
  columns?: BoardColumn[];
}) {
  return (
    <section className="banner activity-feed" aria-label={title}>
      <h2>{title}</h2>
      {unavailable && <p>Activity is temporarily unavailable.</p>}
      {!unavailable && events.length === 0 && <p>No activity yet.</p>}
      {events.length > 0 && (
        <ol className="simple-list">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.actor.displayName}</strong>{' '}
              {actions[event.eventType] ??
                event.eventType.toLowerCase().replaceAll('_', ' ')}
              {details(event, columns) && <> · {details(event, columns)}</>}
              {' · '}
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt)
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ')}{' '}
                UTC
              </time>
            </li>
          ))}
        </ol>
      )}
      {moreHref && (
        <Link className="text-button" href={moreHref}>
          Show more activity
        </Link>
      )}
    </section>
  );
}
