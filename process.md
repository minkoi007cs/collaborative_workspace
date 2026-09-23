# SyncSpace Development Process

## Current Status

Current Phase: Phase 4 — Projects and boards (locally implemented and tested)
Current Milestone: Project/board creation and ordered column management
Current Branch: main
Current Focus: Transition to Phase 5 task management
Last Completed Feature: Workspace-scoped projects, boards, columns, and version-checked ordering
Current Known Issues: No Supabase project credentials; live email/Google sign-in untested; no tasks/real-time; invitation email and archive restore absent; CI has not run on GitHub
Next Recommended Task: Implement Phase 5 tasks, assignment, rank, and movement with concurrency tests

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

## [2026-09-23] Change ID: PROC-003

Author: Codex
Branch: main
Planned Commit Message: `feat(workspaces): add membership and invitation flows`

### Summary

Implemented Phase 3 workspace creation/listing, member management, server-enforced roles, invitation links, ownership transfer, archive, and the corresponding web screens.

### Reason

Authenticated users needed a tenant boundary and a way to collaborate with teammates before project and task features can be built safely.

### Features Added

- Workspace CRUD subset, membership listing, role changes, ownership transfer, leave/remove, and archive.
- Seven-day invitation tokens stored only as SHA-256 hashes; one-time acceptance bound to the signed-in email; pending invitation listing and revocation APIs.
- Web workspace list/create, detail/settings, member roles, invite link, invite acceptance, and safe login continuation.

### Features Modified

- Account page now presents actual workspace state and empty/error states instead of planned feature cards.
- Login/signup and OAuth callback can resume a valid invite path using a short-lived HttpOnly cookie.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema/migration; `apps/api/src/workspaces`; `apps/api/src/users/users.module.ts`; workspace integration test; `apps/web/src/app/app`, `apps/web/src/app/invite`, auth continuation helper/middleware, styles, web unit test, documentation.

### Database Changes

Applied `20260923020000_workspaces`: `WorkspaceRole` enum and workspace/member/invitation tables with foreign keys and indexes.

### API Changes

Added `/api/v1/workspaces` list/create/detail/rename/archive, member listing/role/removal/leave/ownership transfer, invitation create/list/revoke, and `/api/v1/invitations/accept`.

### WebSocket Changes

None; Phase 6 remains pending.

### Security Impact

All workspace routes require verified bearer identity and membership. Role checks run server-side; unauthorized workspace IDs return 404. Owner transfer is transactional. Invitation tokens are random, hashed at rest, time-limited, single-use, and returned with no-store cache headers. Redirect continuation allows only a token-shaped local invite path.

### Tests Added or Updated

- Integration test for outsider denial, viewer edit rejection, token hashing/email binding/replay rejection, owner transfer, and archive.
- Web unit test for safe invite continuation path.

### Tests Run

- `pnpm db:migrate`: applied workspace migration.
- `pnpm check`: passed (format, lint, API/web typecheck, governance and unit tests).
- `pnpm test:integration`: passed (3 integration tests, including workspace authorization).
- `pnpm build`: passed for API and web after stopping a dev server that was competing for Next.js `.next` output.
- Live multi-user browser test: not run; Supabase project is not configured.

### Known Problems

- No projects, boards, tasks, sockets, presence, or activity yet. Invitation delivery is a manually copied link. Archive restore and hard delete are not implemented. Supabase live flow and GitHub CI remain unverified.

### Technical Debt Introduced

- Workspace detail page has basic forms rather than a full settings experience; revisit during UI hardening. Invitation delivery and archive restore need dedicated follow-up milestones.

### Architecture Decisions

- Store durable membership/invitation state in PostgreSQL. Make workspace membership the root authorization boundary. Use one-time random invitation tokens and compare against their hashes.

### tech.nmd Updated?

Yes; data model, API, authorization, frontend, roadmap status, and known limits updated.

### Current Project State After This Change

Phase 3 is locally implemented and tested. A configured Supabase project is still needed to verify browser signup/login and invite acceptance end to end. The product has no projects, boards, tasks, or live sync yet.

### Next Recommended Task

Implement Phase 4 projects, boards, columns, ordering, and workspace navigation with authorization tests.

## [2026-09-23] Change ID: PROC-004

Author: Codex
Branch: main
Planned Commit Message: `feat(projects): add boards and versioned columns`

### Summary

Implemented Phase 4 workspace projects, default and additional boards, editable ordered columns, and web navigation from workspace to project to board. Reviewed API ancestry, role boundaries, stale column updates, and form error handling.

### Reason

Teams need a concrete board structure before task work and real-time collaboration. Column order also needs an explicit conflict strategy so concurrent administrators do not silently overwrite each other.

### Features Added

- Project list/create/detail/update/archive; each new project starts with a main board and three columns.
- Additional board creation and board detail; up to 20 columns per board with add, rename, reorder, and delete.
- Workspace project list, project settings/board list, and responsive board column controls with keyboard accessible left/right movement.

### Features Modified

- Workspace page now shows real projects and creation controls instead of future feature copy.
- Server action redirect logic for column movement keeps stale-version feedback separate from general save failures.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and Phase 4 migration; `apps/api/src/projects`, AppModule, integration test; `apps/web/src/app/app` project/board pages and actions, API contracts, styles, and documentation.

### Database Changes

Applied `20260923030000_projects_boards`: `ProjectStatus`, `projects`, `boards`, and `columns`, with workspace/project/board foreign keys and lookup/order indexes.

### API Changes

Added `GET/POST /workspaces/:workspaceId/projects`; `GET/PATCH/DELETE /projects/:projectId`; `GET/POST /projects/:projectId/boards`; `GET /boards/:boardId`; and column create/rename/delete/reorder routes. Column mutations require `expectedVersion`; a stale or mismatched order returns 409.

### WebSocket Changes

None; Phase 6 remains pending.

### Security Impact

Project and board requests resolve their workspace lineage in the API before checking membership and role. Outsiders get 404 and viewers cannot mutate. Only owner/admin may create or modify projects, boards, and columns. Archived projects and workspaces cannot serve board operations.

### Tests Added or Updated

- Integration test covers default board creation, outsider denial, viewer read/write boundaries, stale column version rejection, reorder validation, and project archive behavior.

### Tests Run

- `pnpm db:migrate`: applied Phase 4 migration locally.
- `pnpm check`: passed (format, lint, typecheck, unit/governance tests; lint emitted two optional-chain style warnings, then fixed).
- `pnpm test:integration`: passed (4 tests, including project/board RBAC and versioning).
- `pnpm build`: passed for API and web.
- Authenticated browser journey: not run; Supabase project remains unconfigured.

### Known Problems

- Boards have columns but no tasks yet. Project/board authenticated screens await live UI verification. Supabase login, invitation delivery, archive restore, GitHub CI, and production deployment remain incomplete.

### Technical Debt Introduced

- Column reorder rewrites each position inside a serializable transaction, acceptable at the 20-column limit. Task ordering will use a separate rank scheme. Project/board settings use basic server forms and need broader UI review once login can run.

### Architecture Decisions

- Project and board IDs do not grant authorization on their own; membership is checked through server-resolved workspace lineage. Board `version` uses compare-and-swap for all column mutations and returns canonical state.

### tech.nmd Updated?

Yes; architecture, data model, API, concurrency, tests, current phase, and known issues updated.

### Current Project State After This Change

Phase 4 is locally implemented and tested. Users with a configured Supabase project can create workspaces, projects, and boards and manage columns. No tasks or real-time sync exist yet.

### Next Recommended Task

Implement Phase 5 tasks, assignment, task rank/movement, and board task UI with concurrency tests.
