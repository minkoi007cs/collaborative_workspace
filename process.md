# SyncSpace Development Process

## Current Status

Current Phase: Phase 6 — Authenticated real-time board events (locally implemented and tested)
Current Milestone: Verified Socket.IO connections, authorized board rooms, and client reconciliation
Current Branch: main
Current Focus: Phase 7 multi-tab Redis presence
Last Completed Feature: Task and board event publication after REST commits, secure room joins, and board refresh on socket events
Current Known Issues: No Supabase project credentials; live email/Google sign-in and authenticated UI untested; no presence/comments/activity; socket publication has no durable replay or multi-instance adapter; invitation email and archive restore absent; first GitHub CI run still needs review
Next Recommended Task: Implement Phase 7 Redis-backed workspace presence and multi-tab disconnect semantics

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

## [2026-09-23] Change ID: PROC-005

Author: Codex
Branch: main
Planned Commit Message: `feat(tasks): add ranked tasks and board movement`

### Summary

Implemented Phase 5 task management and board interaction: task creation/editing, priority, due date, completion, assignments, labels, copy, archive, permanent admin deletion, rank-based movement, and an optimistic drag-and-drop UI with keyboard movement controls.

### Reason

The Phase 4 board contained columns but no work items. Tasks needed server-checked ancestry, role limits, membership-safe assignment, and predictable behavior when two users edit at once.

### Features Added

- Task API with cursor-paginated board list, detail, versioned edits, movement, assignment/label replacement, copy, archive, and admin permanent deletion.
- Project labels; task priority, due date, completion and description; 18-digit lexicographic rank tokens with midpoint insertion and transactional rebalance.
- Board task cards with drag/drop, immediate visual movement, rollback on server rejection, keyboard arrows, and detail forms for editing and assigning.
- Column deletion guard when any task remains in the column; member removal/leave clears that member's task assignments transactionally.

### Features Modified

- Invitation acceptance retries retryable PostgreSQL serializable conflicts, observed when integration suites ran concurrently on unrelated workspaces.
- Board empty state and errors now reflect actual tasks and occupied-column cases.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and Phase 5 migration; `apps/api/src/tasks`, projects column removal, workspace membership removal and acceptance; task/rank integration and unit tests; `apps/web/src/app/app` task page/actions and board interaction component, API contracts, styles, and documentation.

### Database Changes

Applied `20260923040000_tasks`: `TaskPriority`, tasks, task assignees, project labels, and task labels. Task column and board must match through a composite foreign key. Task rank is unique within a column. The task-to-column foreign key restricts deleting a column that still contains tasks, including archived ones.

### API Changes

Added `GET/POST /boards/:boardId/tasks`, `GET/PATCH/DELETE /tasks/:taskId`, `POST /tasks/:taskId/move`, `POST /tasks/:taskId/copy`, `DELETE /tasks/:taskId/permanent`, `PUT /tasks/:taskId/assignees`, `PUT /tasks/:taskId/labels`, and `GET/POST /projects/:projectId/labels`. Board task list pages contain at most 100 tasks and a cursor. Mutations return canonical task state where applicable.

### WebSocket Changes

None; Phase 6 remains pending. Drag/drop currently refetches the board after REST success.

### Security Impact

Task access resolves board/project/workspace lineage and requires membership. Editors and above can mutate tasks; only admins/owners permanently delete. Assignees must be current workspace members; labels must belong to the task's project. The database prevents cross-board task/column pairs. Token validation remains independent of browser state.

### Tests Added or Updated

- Task integration test covers outsider/viewer denial, invalid target column, stale version, movement and rank order, cursor, assignment membership, labels, column deletion, copy, hard delete, archive, and membership assignment cleanup.
- Unit test covers rank midpoint ordering and exhausted gaps.

### Tests Run

- `pnpm db:migrate`: applied Phase 5 migration locally.
- `pnpm check`: passed (format, lint, typecheck, governance/unit tests).
- `pnpm test:integration`: passed (5 tests) in repeated runs after retry fix.
- `pnpm build`: passed for API and web after task page and board interaction additions.
- Authenticated browser drag/drop: not run because live Supabase configuration is absent.

### Known Problems

- No socket delivery, multi-user browser reconciliation, presence, comments, activity, notifications, files, or search. The board UI loads up to 1,000 tasks across ten API pages; larger boards need a stronger virtualized/paged view. Authenticated UI visuals and live provider flows remain unverified.

### Technical Debt Introduced

- Board task drag/drop uses native HTML drag events and one in-flight optimistic move; it has a keyboard arrow alternative but needs multi-user socket reconciliation and accessibility review with live accounts. Rebalance is rare but updates every rank in a crowded column inside a serializable transaction. Archived tasks retain their ranks and block column deletion until permanently deleted or relocated. Task list pagination is capped in the current board view.

### Architecture Decisions

- Use 18-digit zero-padded rank strings so lexicographic database order matches numeric order; assign midpoints for normal moves and rebalance only when no gap exists. Use per-task compare-and-swap `version` with 409 conflicts. Keep REST authoritative; client movement is provisional until the server confirms.

### tech.nmd Updated?

Yes; task data model, API, authorization, concurrency, UI, current status, and technical debt updated.

### Current Project State After This Change

Phases 0–5 are locally implemented and tested. Main branch has been pushed through Phase 4; this Phase 5 commit will be pushed after checks. The product supports workspaces, projects, boards, and tasks with RBAC, but still lacks the real-time collaboration core and configured live Supabase.

### Next Recommended Task

Implement Phase 6 authenticated Socket.IO events, authorized rooms, and client board refresh on relevant events.

## [2026-09-24] Change ID: PROC-006

Author: Codex
Branch: main
Planned Commit Message: `feat(realtime): deliver authorized board events`

### Summary

Implemented Phase 6 Socket.IO board updates. API connections validate Supabase JWTs, board joins check membership through project/workspace lineage, REST task and column mutations emit small events after commit, and board pages refresh on relevant events or reconnection.

### Reason

Phase 5 board state required manual refresh to show teammates' changes. Socket transport also needed explicit authentication, room isolation, expiry, and revocation before serving collaboration events.

### Features Added

- `/realtime` namespace with handshake token and origin checks, a JWT-expiry disconnect timer, authorized `board.join`, `board.leave`, user/workspace/board rooms, and one-board-per-socket room switching.
- Task created/updated/moved/deleted and board updated events carrying actor, entity, scope, version, event ID, and timestamp. REST remains canonical; publication is best effort after committed mutations.
- Board client obtains the current Supabase access token, joins its room, deduplicates event IDs, refreshes server state after events/reconnect, and shows connection status. A server disconnect triggers reauthentication and rejoin.
- Socket integration test for invalid token, outsider denial, viewer access, cross-board isolation, committed task/board events, and member-removal disconnect.

### Features Modified

- JWT identity now includes required expiry for socket lifetime.
- Integration suites run serially to avoid nondeterministic PostgreSQL serializable transaction conflicts between unrelated test fixtures.
- Task movement refreshes canonical board state after network or conflict rollback.

### Features Removed

- None.

### Files / Modules Affected

- `apps/api/src/realtime`, auth, workspace, project, and task controllers/services; API integration tests; `apps/web` board provider/page; package manifests, lockfile, README, `tech.nmd`, and audit.

### Database Changes

None.

### API Changes

Existing task and column REST responses remain unchanged. Their successful mutations now publish matching events after the database operation completes.

### WebSocket Changes

Added `/realtime`, `board.join`, `board.leave`, and `task.created`, `task.updated`, `task.moved`, `task.deleted`, `board.updated`. Events contain identifiers and version, with empty payload; clients fetch canonical REST state.

### Security Impact

JWT signature/issuer/audience/expiry and local user identity are verified before the socket connects. An authorized board lookup precedes room membership. Removed members and archived workspace members are disconnected. Tokens are not logged. A socket cannot remain connected beyond token expiry.

### Tests Added or Updated

- Added realtime integration suite using local signed JWT/JWKS and real Socket.IO clients, PostgreSQL, and Nest app.
- Added auth integration case rejecting tokens without `exp`.

### Tests Run

- API and web TypeScript checks: passed.
- Biome format and lint: passed.
- Governance and API unit tests: passed.
- API integration suite, serial: 6/6 passed; one parallel run showed a transient 409 in an unrelated board transaction, then the board test passed alone.
- API TypeScript build and Next.js production build: passed.
- Authenticated browser two-user test: not run because Supabase project configuration is absent.

### Known Problems

No durable event outbox or replay; an event may be missed if publication fails after a REST commit, and multi-instance delivery requires the Phase 16 Redis adapter. Browser UI and token refresh behavior have not been exercised with live Supabase accounts. Presence, comments, activity, notifications, files, search, and production deployment remain unimplemented. GitHub CI status is still unverified.

### Technical Debt Introduced

Client refreshes the whole board on every relevant event. Large boards and high event volume will benefit from a scoped cache and event batching. Room revocation currently disconnects all of a removed user's sockets, including sockets used in other workspaces, which is safe but can cause a brief reconnect there.

### Architecture Decisions

REST is the source of truth and WebSocket events are invalidation signals. Each socket can join one board at a time; room authorization is checked on every join. The server uses best-effort post-commit publication now and records the need for outbox/replay before stronger delivery guarantees or production scale.

### tech.nmd Updated?

Yes; Phase 6 architecture, event catalog, security, status, and technical debt updated.

### Current Project State After This Change

Phases 0–6 are locally implemented and tested. Main has been pushed through Phase 5; this Phase 6 commit will be pushed after final checks. The product has secure board events but lacks live provider credentials and several MVP features.

### Next Recommended Task

Implement Phase 7 Redis-backed workspace presence with multi-tab semantics, authorization, expiry, and two-client tests.
