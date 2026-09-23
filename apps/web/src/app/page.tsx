import Link from 'next/link';

export default function Home() {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <div className="brand">
          <span className="brand-mark">S</span>SyncSpace
        </div>
        <div className="sidebar-label">Foundation</div>
        <span className="sidebar-item" aria-current="page">
          Overview
        </span>
        <p className="sidebar-note">
          Shared workspaces, live boards, and team collaboration are on the
          roadmap.
        </p>
      </aside>
      <main className="main">
        <div className="topline">SyncSpace · Team collaboration</div>
        <h1>
          One space for work
          <br />
          that moves together.
        </h1>
        <p className="lede">
          SyncSpace brings your team into one place. Create an account and keep
          your profile ready while shared workspaces and live boards take shape.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/signup">
            Create account
          </Link>
          <Link className="secondary-button" href="/login">
            Sign in
          </Link>
        </div>
        <section className="banner" aria-labelledby="foundation-title">
          <span className="badge">Early access</span>
          <h2 id="foundation-title">Built for work that moves together</h2>
          <p>
            Accounts are opening soon. Workspaces, boards, and live
            collaboration are in development.
          </p>
        </section>
        <section className="cards" aria-label="Planned product capabilities">
          <div className="card">
            <span className="icon">01</span>
            <strong>Shared workspaces</strong>
            <p>Bring projects and teammates into a clear home.</p>
          </div>
          <div className="card">
            <span className="icon">02</span>
            <strong>Live boards</strong>
            <p>Keep tasks in sync as plans change.</p>
          </div>
          <div className="card">
            <span className="icon">03</span>
            <strong>Thoughtful permissions</strong>
            <p>Give each member the right level of access.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
