'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Member, TaskComment } from '@/lib/api/types';
import { browserClient } from '@/lib/supabase/browser';
import {
  createComment,
  deleteComment,
  updateComment,
} from '../../comment-actions';
import { ConfirmButton } from '../../workspaces/[workspaceId]/confirm-button';

type TypingEvent = { taskId: string; socketId: string; displayName: string };

export function TaskDiscussion({
  taskId,
  comments,
  members,
  currentUserId,
  canComment,
  more,
  pageCount,
  notice,
  error,
}: {
  taskId: string;
  comments: TaskComment[];
  members: Member[];
  currentUserId: string;
  canComment: boolean;
  more: boolean;
  pageCount: number;
  notice?: string;
  error?: string;
}) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [content, setContent] = useState('');
  const [mentionId, setMentionId] = useState('');
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [live, setLive] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
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
    socketRef.current = socket;
    socket.on('connect', () => {
      socket
        .timeout(5000)
        .emit(
          'task.join',
          { taskId },
          (timeout: Error | null, result?: { ok: boolean }) => {
            setLive(!timeout && Boolean(result?.ok));
            if (!timeout && result?.ok) router.refresh();
            else router.refresh();
          },
        );
    });
    socket.on('disconnect', (reason) => {
      setLive(false);
      setTyping({});
      if (reason === 'io server disconnect') socket.connect();
    });
    for (const name of [
      'comment.created',
      'comment.updated',
      'comment.deleted',
    ])
      socket.on(name, (event: { taskId: string }) => {
        if (event.taskId === taskId) router.refresh();
      });
    socket.on('typing.started', (event: TypingEvent) => {
      if (event.taskId === taskId)
        setTyping((current) => ({
          ...current,
          [event.socketId]: event.displayName,
        }));
    });
    socket.on(
      'typing.stopped',
      (event: { taskId: string; socketId: string }) => {
        if (event.taskId !== taskId) return;
        setTyping((current) => {
          const next = { ...current };
          delete next[event.socketId];
          return next;
        });
      },
    );
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('presence.heartbeat');
    }, 30_000);
    socket.connect();
    return () => {
      clearInterval(heartbeat);
      socket.emit('typing', { taskId, active: false });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [taskId, router]);

  function insertMention() {
    const member = members.find((entry) => entry.user.id === mentionId);
    if (!member) return;
    setContent(
      (current) =>
        `${current}${current && !/\s$/.test(current) ? ' ' : ''}@${member.user.email} `,
    );
    setMentionId('');
  }

  return (
    <section
      className="banner task-discussion"
      aria-labelledby="comments-title"
    >
      <h2 id="comments-title">Comments</h2>
      <p className="board-hint">
        {live
          ? 'Live comments on'
          : 'Live comments unavailable; refresh for changes.'}
      </p>
      {notice && (
        <p className="success-message" role="status">
          Comment {notice}.
        </p>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error === 'conflict'
            ? 'This comment changed. Review the latest version before saving.'
            : 'Could not save comment. Check the text and try again.'}
        </p>
      )}
      {comments.length === 0 && <p>No comments yet.</p>}
      <div className="comment-list">
        {comments.map((comment) => (
          <article
            className="comment-item"
            key={`${comment.id}:${comment.version}`}
          >
            <p>
              <strong>{comment.author.displayName}</strong>{' '}
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleString()}
              </time>
            </p>
            <p className="comment-content">{comment.content}</p>
            {canComment && comment.author.id === currentUserId && (
              <div className="comment-actions">
                <details>
                  <summary>Edit comment</summary>
                  <form action={updateComment} className="inline-form">
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={comment.version}
                    />
                    <label htmlFor={`edit-comment-${comment.id}`}>
                      Comment
                    </label>
                    <textarea
                      id={`edit-comment-${comment.id}`}
                      name="content"
                      defaultValue={comment.content}
                      maxLength={4000}
                      rows={3}
                      required
                    />
                    <button type="submit" className="secondary-button">
                      Save comment
                    </button>
                  </form>
                </details>
                <form action={deleteComment}>
                  <input type="hidden" name="taskId" value={taskId} />
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={comment.version}
                  />
                  <ConfirmButton
                    className="text-button"
                    message="Delete this comment?"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            )}
          </article>
        ))}
      </div>
      {more && (
        <Link
          className="text-button"
          href={`/app/tasks/${taskId}?commentPages=${pageCount + 1}`}
        >
          Show more comments
        </Link>
      )}
      {Object.keys(typing).length > 0 && (
        <p className="board-hint" aria-live="polite">
          {[...new Set(Object.values(typing))].join(', ')} typing…
        </p>
      )}
      {canComment && (
        <form action={createComment} className="inline-form action-divider">
          <input type="hidden" name="taskId" value={taskId} />
          <label htmlFor="new-comment">Add comment</label>
          <textarea
            id="new-comment"
            name="content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              socketRef.current?.emit('typing', { taskId, active: true });
            }}
            onBlur={() =>
              socketRef.current?.emit('typing', { taskId, active: false })
            }
            maxLength={4000}
            rows={4}
            required
            placeholder="Write a comment. Mention a member with @email."
          />
          <div className="comment-mention-picker">
            <label htmlFor="mention-member">Mention member</label>
            <select
              id="mention-member"
              value={mentionId}
              onChange={(event) => setMentionId(event.target.value)}
            >
              <option value="">Choose a member</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.displayName} ({member.user.email})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-button"
              onClick={insertMention}
              disabled={!mentionId}
            >
              Insert mention
            </button>
          </div>
          <button type="submit" className="secondary-button">
            Post comment
          </button>
        </form>
      )}
    </section>
  );
}
