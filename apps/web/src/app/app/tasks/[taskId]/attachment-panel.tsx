'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { TaskAttachment } from '@/lib/api/types';
import {
  deleteAttachment,
  finishAttachmentUpload,
  requestAttachmentUpload,
} from './attachment-actions';

export function AttachmentPanel({
  taskId,
  attachments,
  canEdit,
  canManage,
  currentUserId,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  canEdit: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const prepared = await requestAttachmentUpload(
        taskId,
        file.name,
        file.type,
        file.size,
      );
      if ('error' in prepared) {
        setError(prepared.error ?? 'Could not prepare upload.');
        return;
      }
      const response = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) {
        setError('Upload failed. Check your connection and try again.');
        return;
      }
      const finished = await finishAttachmentUpload(
        taskId,
        prepared.attachment.id,
      );
      if ('error' in finished) {
        setError(finished.error ?? 'Could not finish upload.');
        return;
      }
      if (input.current) input.current.value = '';
      setNotice('File added.');
      router.refresh();
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(attachmentId: string) {
    if (busy || !window.confirm('Delete this file permanently?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await deleteAttachment(taskId, attachmentId);
      if ('error' in result) setError(result.error ?? 'Could not delete file.');
      else {
        setNotice('File deleted.');
        router.refresh();
      }
    } catch {
      setError('Could not delete this file. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="banner" aria-labelledby="attachments-title">
      <h2 id="attachments-title">Files</h2>
      <p className="board-hint">
        PDF, JPG, PNG, WebP or text · 10 MB maximum · up to 20 files
      </p>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {attachments.length === 0 ? (
        <p>No files yet.</p>
      ) : (
        <ul className="attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="attachment-row">
              <div>
                <a href={`/app/attachments/${attachment.id}/download`}>
                  {attachment.fileName}
                </a>
                <small>
                  {' '}
                  · {(attachment.size / 1024).toFixed(0)} KB ·{' '}
                  {attachment.uploader.displayName}
                </small>
              </div>
              {canEdit &&
                (canManage || attachment.uploader.id === currentUserId) && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => remove(attachment.id)}
                  >
                    Delete
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && attachments.length < 20 && (
        <div className="inline-form action-divider">
          <label htmlFor="task-file">Add a file</label>
          <input
            id="task-file"
            ref={input}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
            disabled={busy}
          />
          <button
            className="secondary-button"
            type="button"
            onClick={upload}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Upload file'}
          </button>
        </div>
      )}
    </section>
  );
}
