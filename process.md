# SyncSpace Development Process

## Current Status

Current Phase: Phase 2 — Authentication (locally implemented; live provider not configured)
Current Milestone: Verified bearer identity and user profile
Current Branch: main (initial repository)
Current Focus: Audit and transition to Phase 3 workspaces
Last Completed Feature: Protected profile API and web account flows
Current Known Issues: No Supabase project credentials; live email/Google sign-in untested; no workspaces/boards/tasks/real-time; CI has not run on GitHub
Next Recommended Task: Implement Phase 3 workspaces, membership, RBAC, and invitations

---

## Development History

## [2026-09-23] Change ID: PROC-001

Author: Codex
Branch: main (initial repository)
Planned Commit Message: `feat(auth): establish foundation and verified accounts`

### Summary

Initialized the empty repository; completed Phase 0 governance and the locally tested Phase 1 foundation.

### Reason

The project needs an authoritative architecture, chronological handoff, enforceable commit process, and runnable base before product features.

### Features Added

- `tech.nmd`, `process.md`, contributor guidance, README, environment example, pre-commit hook, and GitHub Actions gates.
- pnpm monorepo with Next.js App Router, NestJS, Prisma/PostgreSQL, Redis, Docker Compose, and a basic responsive web shell.
- Environment validation and `/api/v1/health` readiness endpoint.

### Features Modified

- None.

### Features Removed

- None.

### Files / Modules Affected

- Root documentation/configuration, `scripts/`, `.husky/`, `.github/workflows/ci.yml`, `apps/web/`, `apps/api/`, and `docker-compose.yml`.

### Database Changes

Added and applied `20260923000000_foundation`, creating `infrastructure_probe`. No product tables yet.

### API Changes

Added `GET /api/v1/health`: HTTP 200 when PostgreSQL and Redis respond; HTTP 503 with service status otherwise.

### WebSocket Changes

None; real-time implementation belongs to Phase 6.

### Security Impact

Commit documentation gate and environment validation added; product authentication and authorization remain future work.

### Tests Added or Updated

- Two governance tests (staged and history rejection), two API environment unit tests, and one PostgreSQL/Redis health integration test.

### Tests Run

- `pnpm check`: passed (format, lint, API/web typecheck, 4 unit/governance tests).
- `pnpm test:integration`: passed (1 integration test with local PostgreSQL and Redis).
- `pnpm build`: passed (API and web production builds).
- `prisma migrate deploy`: applied the foundation migration successfully.
- `pnpm db:migrate`: passed on rerun with no pending migrations.
- Docker Compose health checks: PostgreSQL and Redis healthy.
- GitHub Actions: configured but not yet run remotely.

### Known Problems

- Product functionality and authentication are not implemented. No production deployment or remote CI run exists.

### Technical Debt Introduced

- The probe table is a temporary infrastructure aid and should be removed with a reviewed migration once domain tables provide a useful database health query.

### Architecture Decisions

- See ADR-001 through ADR-005 in `tech.nmd`. Local Docker host ports are 55432/56379 to avoid collisions.

### tech.nmd Updated?

Yes; initial specification created.

### Current Project State After This Change

Phases 0 and 1 are locally implemented and tested. The web shell describes future capabilities accurately. The only API route is health. No auth, workspace, task, WebSocket, presence, or notification code exists. CI is ready for its first GitHub run.

### Next Recommended Task

Implement Phase 2: Supabase email/password and Google OAuth, backend JWT verification, local user profile, and protected routes with integration tests. Keep `tech.nmd` and this log current.

## [2026-09-23] Change ID: PROC-002

Author: Codex
Branch: main (initial repository)
Planned Commit Message: `feat(auth): establish foundation and verified accounts`

### Summary

Added Phase 2 Supabase SSR account flows, independently verified API tokens, and a persistent local user profile. Audited module boot, token trust, cookie caching, and narrow-viewport UI.

### Reason

Phase 1 had no user identity or usable account journey. The initial Phase 2 draft also failed at Nest dependency injection until fixed.

### Features Added

- Email/password signup/signin, Google OAuth callback, local sign-out, protected `/app`, and profile editing.
- AuthGuard verifies bearer tokens using the trusted Supabase project's JWKS, issuer, audience, expiry, role, and subject. User IDs come from verified tokens.
- `GET` and `PATCH /api/v1/users/me`, persisted through a new `users` table.
- Audit document in `docs/audit-2026-09-23.md`.

### Features Modified

- Refactored Prisma into a shared module and fixed AuthModule export required by AuthGuard.
- Changed the landing page to provide account entry points and clear availability messaging.

### Features Removed

- None.

### Files / Modules Affected

- `apps/api/src/auth`, `apps/api/src/users`, `apps/api/src/database`, API tests and Prisma migration; `apps/web/src/app`, Supabase helpers, middleware, root environment and documentation.

### Database Changes

Applied migration `20260923010000_auth_user` to add `users` with a unique `auth_subject`. It does not store credentials.

### API Changes

Added authenticated `GET /api/v1/users/me` and validated `PATCH /api/v1/users/me`.

### WebSocket Changes

None; Phase 6 remains pending.

### Security Impact

API verifies signed Supabase tokens independently; protected SSR route verifies claims. Cookie refresh response carries private cache headers. No caller-supplied user ID is trusted. Live token revocation remains bounded by access-token lifetime and JWKS cache duration.

### Tests Added or Updated

- API integration tests for missing, malformed, wrong-audience, expired, and valid JWTs using local JWKS; profile persistence and invalid input.
- Retained full Nest module startup in health integration test, which caught the dependency injection bug.

### Tests Run

- `pnpm check`: passed after Prisma client generation and module fix.
- `pnpm test:integration`: passed for health and auth/profile against local PostgreSQL/Redis.
- `pnpm build`: passed for API and Next.js pages.
- `pnpm db:migrate`: applied User migration.
- Browser: inspected landing, signup, and unauthenticated `/app` redirect at a narrow viewport.
- Live Supabase email and Google flows: not run; project credentials/provider configuration unavailable.

### Known Problems

- No configured Supabase project; browser cannot complete a live sign-in yet.
- Workspaces, boards, tasks, and real-time collaboration remain unimplemented. GitHub CI has not run remotely.

### Technical Debt Introduced

- Auth currently verifies access tokens offline; immediate per-session revocation requires an online provider check or shorter token TTL if later product risk warrants it.

### Architecture Decisions

- Use Supabase SSR cookie sessions on Next.js and JOSE JWKS verification in NestJS. Identity is mapped lazily to a local User record.

### tech.nmd Updated?

Yes; stack, auth, web/API architecture, data model, endpoints, environment, status, and limitations updated.

### Current Project State After This Change

Phase 2 code and local API tests are complete. Account UI is present but disabled until real Supabase configuration is supplied. No collaboration entities exist yet.

### Next Recommended Task

Implement Phase 3 workspaces, membership RBAC, and invitations with server-side authorization tests.
