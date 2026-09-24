import Link from 'next/link';
import { supabaseConfig } from '@/lib/supabase/config';

const features = [
  {
    number: '01',
    title: 'A home for every team',
    description:
      'Give each project a place to live. Invite teammates and choose who can view, edit, or manage the work.',
    detail: 'Workspaces · Projects · Permissions',
  },
  {
    number: '02',
    title: 'Boards that stay in sync',
    description:
      'Move a task once and everyone sees the change. Presence and clear conflict messages keep plans current.',
    detail: 'Live updates · Presence · Version control',
  },
  {
    number: '03',
    title: 'Context lives with the task',
    description:
      'Keep assignments, comments, files, due dates, and activity together so the next step is easy to find.',
    detail: 'Comments · Files · Notifications',
  },
];

export default function Home() {
  const accountAccess = Boolean(supabaseConfig());
  return (
    <div className="site-page">
      <header className="site-header">
        <div className="site-container site-header-inner">
          <Link
            href="/"
            className="brand site-brand"
            aria-label="SyncSpace home"
          >
            <span className="brand-mark">S</span>SyncSpace
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/login">Sign in</Link>
          </nav>
          <Link
            className="site-nav-cta"
            href={accountAccess ? '/signup' : '#features'}
          >
            {accountAccess ? 'Get started' : 'Explore SyncSpace'}{' '}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main>
        <section className="site-hero" aria-labelledby="site-title">
          <div className="site-container site-hero-grid">
            <div className="site-hero-copy">
              <span className="site-kicker">
                <span className="site-kicker-dot" /> Made for work in motion
              </span>
              <h1 id="site-title">
                Move work forward, <em>together.</em>
              </h1>
              <p>
                Plan in shared boards, discuss the details, and see your team’s
                progress as it happens. One clear place for the work you do
                together.
              </p>
              <div className="site-hero-actions">
                <Link
                  className="site-primary"
                  href={accountAccess ? '/signup' : '#features'}
                >
                  {accountAccess
                    ? 'Start a workspace'
                    : 'See what SyncSpace does'}{' '}
                  <span aria-hidden="true">→</span>
                </Link>
                <a className="site-secondary" href="#how-it-works">
                  How it works <span aria-hidden="true">↓</span>
                </a>
              </div>
              {!accountAccess && (
                <p className="site-access-note" role="status">
                  Account access is temporarily unavailable. You can explore the
                  product below.
                </p>
              )}
              <div className="site-hero-proof">
                <span>Live collaboration</span>
                <span>Clear permissions</span>
                <span>Everything in context</span>
              </div>
            </div>
            <div className="site-preview-wrap" aria-hidden="true">
              <div className="site-preview-orbit site-preview-orbit-one" />
              <div className="site-preview-orbit site-preview-orbit-two" />
              <div className="site-preview">
                <div className="site-preview-top">
                  <div className="site-preview-logo">S</div>
                  <div className="site-preview-crumb">
                    Acme Studio <span>/</span> Product launch
                  </div>
                  <div className="site-preview-avatars">
                    <i>AL</i>
                    <i>MK</i>
                    <i>JD</i>
                  </div>
                </div>
                <div className="site-preview-heading">
                  <div>
                    <small>PRODUCT LAUNCH</small>
                    <strong>Launch board</strong>
                  </div>
                  <span>● 3 online</span>
                </div>
                <div className="site-preview-board">
                  <div className="site-preview-column">
                    <div className="site-preview-column-heading">
                      <b>To do</b>
                      <span>2</span>
                    </div>
                    <div className="site-preview-task">
                      <small>DESIGN</small>
                      <strong>Review onboarding flow</strong>
                      <span>◷ Due Friday</span>
                    </div>
                    <div className="site-preview-task">
                      <small>PRODUCT</small>
                      <strong>Write release notes</strong>
                      <span>◎ 2 teammates</span>
                    </div>
                  </div>
                  <div className="site-preview-column">
                    <div className="site-preview-column-heading">
                      <b>In progress</b>
                      <span>2</span>
                    </div>
                    <div className="site-preview-task site-preview-task-active">
                      <small>ENGINEERING</small>
                      <strong>Polish workspace settings</strong>
                      <span>◎ 3 teammates</span>
                    </div>
                    <div className="site-preview-task">
                      <small>CONTENT</small>
                      <strong>Prepare help center</strong>
                      <span>◷ Due Monday</span>
                    </div>
                  </div>
                  <div className="site-preview-column">
                    <div className="site-preview-column-heading">
                      <b>Done</b>
                      <span>1</span>
                    </div>
                    <div className="site-preview-task">
                      <small>FOUNDATION</small>
                      <strong>Set up project board</strong>
                      <span>✓ Completed</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="site-preview-toast">
                <span>✓</span>
                <div>
                  <strong>Everyone is up to date</strong>
                  <small>Changes appear across your team</small>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          className="site-features site-container"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="site-section-heading">
            <div>
              <p className="site-section-label">THE WORK, ALL IN ONE PLACE</p>
              <h2 id="features-title">Less chasing. More doing.</h2>
            </div>
            <p>
              From the first idea to the final update, your team has a shared
              view of what matters.
            </p>
          </div>
          <div className="site-feature-grid">
            {features.map((feature) => (
              <article className="site-feature" key={feature.number}>
                <span className="site-feature-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <small>{feature.detail}</small>
              </article>
            ))}
          </div>
        </section>
        <section
          className="site-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="site-container site-workflow-grid">
            <div>
              <p className="site-section-label">SIMPLE BY DESIGN</p>
              <h2 id="workflow-title">
                Bring the team in. Keep the work moving.
              </h2>
              <p>
                SyncSpace gives every teammate the right view and keeps the
                conversation close to the work.
              </p>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Create a workspace</strong>
                  <p>Give your team a shared home for projects and boards.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Plan the work</strong>
                  <p>
                    Organize tasks, owners, priorities, and due dates in one
                    view.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Move together</strong>
                  <p>
                    See updates, comments, activity, and teammates in real time.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className="site-final site-container">
          <div>
            <p className="site-section-label">READY WHEN YOUR TEAM IS</p>
            <h2>A clearer way to work together.</h2>
            <p>
              Make room for the work that matters, and keep everyone moving in
              the same direction.
            </p>
          </div>
          <Link
            className="site-primary"
            href={accountAccess ? '/signup' : '/login'}
          >
            {accountAccess ? 'Create your workspace' : 'View account access'}{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container">
          <span>
            <span className="site-footer-mark">S</span> SyncSpace
          </span>
          <p>Built for teams that move together.</p>
          <a
            href="https://github.com/minkoi007cs/collaborative_workspace"
            target="_blank"
            rel="noreferrer"
          >
            View source ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
