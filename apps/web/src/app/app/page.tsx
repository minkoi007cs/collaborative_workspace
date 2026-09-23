import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifiedAccessToken } from '@/lib/supabase/access-token';
import { updateProfile } from './actions';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';

type Profile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const token = await verifiedAccessToken();
  if (!token) redirect('/login');
  const params = await searchParams;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  let profile: Profile | null = null;
  if (apiUrl) {
    const response = await fetch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => null);
    if (response?.ok) profile = (await response.json()) as Profile;
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <Link href="/" className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </Link>
        <div className="sidebar-label">Your space</div>
        <span className="sidebar-item" aria-current="page">
          Profile
        </span>
        <p className="sidebar-note">
          Workspaces and boards are the next milestone.
        </p>
      </aside>
      <main className="main">
        <div className="dashboard-top">
          <div>
            <p className="topline">Your account</p>
            <h1>Welcome to SyncSpace</h1>
            <p className="lede">
              Your account is ready. Keep your profile current while we build
              shared workspaces.
            </p>
          </div>
          <SignOutButton />
        </div>
        {!profile ? (
          <section className="banner" role="alert">
            <h2>Profile unavailable</h2>
            <p>
              The API could not load your profile. Check that the API is running
              and its Supabase URL matches the web app, then refresh this page.
            </p>
          </section>
        ) : (
          <section
            className="banner profile-panel"
            aria-labelledby="profile-title"
          >
            <span className="badge">Account</span>
            <h2 id="profile-title">Your profile</h2>
            <p className="profile-email">{profile.email}</p>
            <form action={updateProfile} className="profile-form">
              <label htmlFor="displayName">Display name</label>
              <div className="profile-form-row">
                <input
                  id="displayName"
                  name="displayName"
                  defaultValue={profile.displayName}
                  maxLength={80}
                  required
                />
                <button className="primary-button" type="submit">
                  Save changes
                </button>
              </div>
            </form>
            {params.updated === '1' && (
              <p className="success-message" role="status">
                Profile updated.
              </p>
            )}
            {params.error && (
              <p className="form-message" role="alert">
                {params.error === 'invalid-name'
                  ? 'Enter a name between 1 and 80 characters.'
                  : 'Could not save your profile. Please try again.'}
              </p>
            )}
          </section>
        )}
        <section className="cards" aria-label="Coming next">
          <div className="card">
            <span className="icon">01</span>
            <strong>Shared workspaces</strong>
            <p>Create a home for your team and invite members.</p>
          </div>
          <div className="card">
            <span className="icon">02</span>
            <strong>Live boards</strong>
            <p>Organize tasks together in real time.</p>
          </div>
          <div className="card">
            <span className="icon">03</span>
            <strong>Clear permissions</strong>
            <p>Keep every action within the right role.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
