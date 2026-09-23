'use client';

import { useActionState, useEffect, useState } from 'react';
import { createInvitation, type InviteState } from '../../workspace-actions';

const initial: InviteState = { link: '', error: '' };

export function InviteForm({
  workspaceId,
  canInviteAdmin,
}: {
  workspaceId: string;
  canInviteAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(createInvitation, initial);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  async function copyLink() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${state.link}`,
      );
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Copy failed. Select the link above to copy it manually.');
    }
  }

  return (
    <div className="workspace-section">
      <h2>Invite a teammate</h2>
      <p>Invite someone by email, then share their one-time link securely.</p>
      <form action={action} className="inline-form">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="teammate@example.com"
        />
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" name="role" defaultValue="EDITOR">
          <option value="EDITOR">Editor</option>
          <option value="VIEWER">Viewer</option>
          {canInviteAdmin && <option value="ADMIN">Admin</option>}
        </select>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create invite link'}
        </button>
      </form>
      {state.error && (
        <p className="form-message" role="alert">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="invite-result" role="status">
          <p>Invite link created. Copy it now; the token is only shown once.</p>
          <div className="profile-form-row">
            <input
              aria-label="Invitation link"
              readOnly
              value={`${origin}${state.link}`}
            />
            <button
              className="secondary-button"
              type="button"
              onClick={copyLink}
            >
              {copied ? 'Copied' : 'Copy full link'}
            </button>
          </div>
          {copyError && (
            <p className="form-message" role="alert">
              {copyError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
