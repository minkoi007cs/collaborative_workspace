import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError, apiRequest } from '@/lib/api/server';
import type { Notification, NotificationPage } from '@/lib/api/types';
import { verifiedAccessToken } from '@/lib/supabase/access-token';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '../notification-actions';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pages?: string; error?: string }>;
}) {
  if (!(await verifiedAccessToken())) redirect('/login');
  const params = await searchParams;
  const pageCount = Math.min(Math.max(Number(params.pages) || 1, 1), 10);
  const items: Notification[] = [];
  let nextCursor: string | null = null;
  let unreadCount = 0;
  let unavailable = false;
  try {
    const first = await apiRequest<NotificationPage>('/notifications');
    items.push(...first.items);
    nextCursor = first.nextCursor;
    unreadCount = first.unreadCount;
    for (let page = 1; page < pageCount && nextCursor; page++) {
      const next: NotificationPage = await apiRequest<NotificationPage>(
        `/notifications?cursor=${nextCursor}`,
      );
      items.push(...next.items);
      nextCursor = next.nextCursor;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    unavailable = true;
  }
  return (
    <main className="main notification-page">
      <Link href="/app">← All workspaces</Link>
      <div className="section-heading">
        <div>
          <p className="topline">Updates for you</p>
          <h1>Notifications</h1>
          <p>{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="secondary-button" type="submit">
              Mark all as read
            </button>
          </form>
        )}
      </div>
      {params.error && (
        <p className="form-message" role="alert">
          Could not update the notification. Please try again.
        </p>
      )}
      {unavailable ? (
        <p role="alert">Notifications are temporarily unavailable.</p>
      ) : items.length === 0 ? (
        <div className="empty-state">No notifications yet.</div>
      ) : (
        <ol className="notification-list">
          {items.map((item) => (
            <li
              className={`banner notification-item${item.readAt ? '' : ' unread'}`}
              key={item.id}
            >
              <div>
                <p>
                  {item.type === 'DUE_SOON' ? (
                    item.task?.dueAt &&
                    new Date(item.task.dueAt) <= new Date() ? (
                      'Task overdue:'
                    ) : (
                      'Due within 24 hours:'
                    )
                  ) : (
                    <>
                      <strong>{item.actor?.displayName ?? 'A teammate'}</strong>{' '}
                      {item.type === 'MENTION'
                        ? 'mentioned you in'
                        : item.type === 'ASSIGNMENT'
                          ? 'assigned you to'
                          : item.type === 'COMMENT'
                            ? 'commented on'
                            : 'changed your role in'}
                    </>
                  )}{' '}
                  {item.task && item.taskId ? (
                    item.task.archivedAt ? (
                      <strong>{item.task.title}</strong>
                    ) : (
                      <Link href={`/app/tasks/${item.taskId}`}>
                        {item.task.title}
                      </Link>
                    )
                  ) : (
                    <Link href={`/app/workspaces/${item.workspaceId}`}>
                      {item.workspace.name}
                    </Link>
                  )}
                  {item.task ? ` · ${item.workspace.name}` : ''}
                </p>
                <small>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt)
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' ')}{' '}
                    UTC
                  </time>
                  {item.readAt ? ' · Read' : ' · Unread'}
                </small>
              </div>
              {!item.readAt && (
                <form action={markNotificationRead}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="text-button" type="submit">
                    Mark read
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
      {nextCursor && pageCount < 10 && (
        <Link
          className="text-button"
          href={`/app/notifications?pages=${pageCount + 1}`}
        >
          Show more notifications
        </Link>
      )}
    </main>
  );
}
