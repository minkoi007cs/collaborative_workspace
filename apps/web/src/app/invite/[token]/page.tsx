import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { verifiedAccessToken } from '@/lib/supabase/access-token';
import { acceptInvitation } from '../../app/workspace-actions';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-zA-Z0-9_-]{43}$/.test(token)) notFound();
  const accessToken = await verifiedAccessToken();
  if (!accessToken)
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <p className="eyebrow">Team invitation</p>
        <h1>Join this workspace</h1>
        <p className="auth-intro">
          Accept this invitation using the email address it was sent to.
        </p>
        <form action={acceptInvitation}>
          <input type="hidden" name="token" value={token} />
          <button className="primary-button" type="submit">
            Accept invitation
          </button>
        </form>
        <p className="auth-switch">
          <Link href="/app">Back to your account</Link>
        </p>
      </div>
    </main>
  );
}
