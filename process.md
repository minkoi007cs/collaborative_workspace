# SyncSpace Development Process

## Current Status

Current Phase: Phase 14 hardening and product audit following Phase 16 delivery
Current Milestone: Realtime room authorization, public UX, and dependency security verified locally and in GitHub CI
Current Branch: main
Current Focus: Configure and validate Supabase Auth and private Storage, then prepare deployment operations
Last Completed Feature: Audit fixes for realtime rooms, typing permission, invitation continuation, upload quota, landing UX, and transitive advisories passed GitHub CI
Current Known Issues: No Supabase project credentials; live email/Google sign-in, authenticated UI, and real-bucket upload untested; invitation email delivery absent; pending upload/orphan cleanup; search covers task text only; inbox requires refresh; due scans can lag 15 minutes; activity writes can leave gaps on postcommit failure; socket publication has no durable replay; archive restore absent
Next Recommended Task: Supply project Supabase configuration and private bucket for live end-to-end QA; address upload reconciliation; plan deployment operations

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

## [2026-09-24] Change ID: PROC-007

Author: Codex
Branch: main
Planned Commit Message: `feat(presence): track workspace users across tabs`

### Summary

Implemented Phase 7 Redis-backed workspace presence. Board pages show online members, update on online/offline events, and refresh leases and snapshots every 30 seconds.

### Reason

Task events alone do not tell collaborators who is available. Presence must account for multiple tabs and devices, network loss, and membership revocation without storing online status as permanent database state.

### Features Added

- Redis sorted-set leases per socket with 90-second expiry and atomic Lua join/leave operations. Workspace snapshots prune expired users and filter current memberships.
- `presence.online`, `presence.offline`, and `presence.heartbeat` with board authorization before heartbeat renewal. One tab disconnecting does not mark a user offline while another lease remains.
- Board online-member list and a visible unavailable state if Redis presence fails. Heartbeat acknowledgements refresh the list after missed events.
- Integration coverage for two tabs of the same user, one-user snapshot deduplication, heartbeat, no premature offline event, and offline after the last tab is disconnected by member removal.

### Features Modified

- `board.join` returns a presence snapshot, and board leave/disconnect clears the socket lease.
- Socket gateway reconnect and room switching retain correct workspace presence scope; project archive now disconnects affected board sockets.

### Features Removed

- None.

### Files / Modules Affected

- `apps/api/src/realtime`, realtime integration test, `apps/web` board page/provider, README, `tech.nmd`, audit, and this log.

### Database Changes

None. Presence is stored only in Redis with expiring leases.

### API Changes

No REST route changes.

### WebSocket Changes

Added `presence.heartbeat` acknowledgement with an online-member snapshot, plus `presence.online/offline` events scoped to the workspace room. `board.join` acknowledgement includes `presence` and `presenceAvailable`.

### Security Impact

Only authenticated, workspace-authorized board sockets can register presence. Heartbeats recheck board membership. Snapshot results are filtered against current memberships. Member removal and project/workspace archive disconnect sockets and release their leases.

### Tests Added or Updated

- Extended realtime integration test with two viewer sockets, heartbeat, snapshot deduplication, last-socket offline transition, and project-archive socket eviction.

### Tests Run

- Biome format/lint and API/web TypeScript: passed.
- API integration suite, serial: 6/6 passed.
- API TypeScript production build and Next.js production build: passed.
- Live browser multi-user check: not run because Supabase project credentials are absent.

### Known Problems

Socket event publication still has no durable replay or cross-instance adapter. Presence leases expire after crashes, and the client heartbeat snapshot repairs the display; an immediate offline event is not guaranteed after a process crash. Authenticated UI visuals and Google OAuth remain unverified without a live Supabase project. Comments, activity, notifications, files, and search remain.

### Technical Debt Introduced

Presence snapshots query current memberships on each board join and heartbeat. At high connection counts, cache or batch this read. Redis Lua scripts assume a shared Redis deployment and use a workspace hash tag to keep their keys compatible with clustered key slots, but multi-instance Socket.IO event fanout is deferred to Phase 16.

### Architecture Decisions

Presence is a per-socket Redis lease with a workspace user index. Atomic scripts decide the first online and last offline transitions, while periodic authorized snapshots repair missed events. Presence errors degrade the indicator without rejecting an otherwise authorized board connection.

### tech.nmd Updated?

Yes; presence state, event catalog, Redis behavior, status, and ADR-003 updated.

### Current Project State After This Change

Phases 0–7 are locally implemented and tested; Phase 6 is on GitHub main. Phase 7 is ready to commit and push. The product still lacks live provider configuration and several MVP features.

### Next Recommended Task

Complete Phase 8 optimistic UI and concurrency hardening, then Phase 9 comments and typing indicators.

## [2026-09-24] Change ID: PROC-008

Author: Codex
Branch: main
Planned Commit Message: `fix(tasks): reconcile concurrent board edits`

### Summary

Completed Phase 8 by hardening the optimistic board movement already introduced in Phase 5 and verifying a real two-writer task move conflict.

### Reason

React pending state does not synchronously block two rapid input events. Conflict responses also need a clear return to canonical server state so users can safely retry.

### Features Added

- Concurrent integration test sends two valid moves of the same task and expected version from different editors; it asserts one 201, one 409, and the winning canonical version/column.
- Task detail form subtree remounts when task version changes, so a redirected conflict view shows current field values.

### Features Modified

- Board movement uses a synchronous in-flight guard, rolls back a rejected move, refreshes the board, and explains that the latest state has loaded.
- Task server actions revalidate the task route on 409 before redirecting to conflict feedback.

### Features Removed

- None.

### Files / Modules Affected

- Board task provider, task detail page and actions, task integration test, `tech.nmd`, audit, and this log.

### Database Changes

None. Existing task `version` and rank constraints remain authoritative.

### API Changes

No route changes. Existing optimistic concurrency returns 409 for stale task edits and moves.

### WebSocket Changes

None. Phase 6 board events continue to trigger canonical refresh.

### Security Impact

No permission changes. The server still checks editor membership and expected version; the client guard is for UX, not authorization.

### Tests Added or Updated

- Added simultaneous owner/editor move requests against one task version, then checked the winning persisted state and archived the test task.

### Tests Run

- Biome format/lint and API/web TypeScript: passed.
- Task integration test: passed.
- Full serial API integration suite: 6/6 passed.
- Next.js production build: passed. API production build passed in Phase 7 and API production code did not change in this commit.
- Authenticated browser drag/drop remains untested without live Supabase configuration.

### Known Problems

The task board still progressively loads at most 1,000 tasks and refreshes the whole board on remote events. Live two-user browser visuals cannot be checked without provider credentials. Comments, activity, notifications, files, search, reliable event replay, multi-instance socket fanout, and deployment remain.

### Technical Debt Introduced

No new persistent debt. A more granular task cache and full keyboard drag/drop interaction may be warranted for large boards.

### Architecture Decisions

Keep task version compare-and-swap on the server and treat optimistic client state as provisional. A conflict returns a canonical server refresh; the rejected local move never overwrites the winner.

### tech.nmd Updated?

Yes; optimistic UI and current phase updated.

### Current Project State After This Change

Phases 0–8 are locally implemented and tested. Main is pushed through Phase 7; this Phase 8 change is ready to commit and push. Several MVP features still remain.

### Next Recommended Task

Implement Phase 9 persisted task comments with mentions, authorized real-time events, and scoped typing indicators.

## [2026-09-24] Change ID: PROC-009

Author: Codex
Branch: main
Planned Commit Message: `feat(comments): add task discussion and mentions`

### Summary

Implemented Phase 9 task comments, current-member mentions, mention notification records, authorized real-time comment events, and short-lived typing indicators.

### Reason

The MVP requires people to discuss tasks in context. Comment access must follow task/workspace permissions, edits must not overwrite concurrent changes, and typing must remain ephemeral.

### Features Added

- Comment, mention, and first notification schema/migration. Comments use author ownership, soft deletion, and integer version. Mention notifications are created in the same transaction as the comment.
- Paginated comment API with create/edit/delete; `@member@example.com` mentions must resolve to current workspace members. Unknown member mentions are rejected.
- Task discussion UI with text-safe rendering, edit/delete controls for the author, member mention picker, pagination, and conflict feedback.
- Authorized `task.join` room, comment created/updated/deleted events, user-scoped `notification.created`, and rate-limited `typing.started/stopped` with five-second expiry. Task page sockets also participate in workspace presence.
- Task archive closes task sockets; project/workspace archive and membership removal close affected task sockets through their authorized rooms.

### Features Modified

- Task page now fetches comments and connects to the task room for live refresh and typing.
- Realtime publisher carries comment actor/version and user-scoped mention notices.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and migration, comments API module, realtime gateway/publisher, task controller, API integration tests, task page/discussion/actions/styles/types, README, audit, `tech.nmd`, and this log.

### Database Changes

Applied `20260924041857_comments_mentions`: `comments`, `comment_mentions`, `notifications`, indexes, foreign keys, and `NotificationType.MENTION`. Notification inbox/read routes are deferred to Phase 11.

### API Changes

Added `GET/POST /tasks/:taskId/comments`, `PATCH/DELETE /comments/:commentId`. Lists return 50 items plus cursor; writes validate 4,000-character content, membership mentions, role, ownership, and expected version.

### WebSocket Changes

Added `task.join`, `typing` input, `comment.created/updated/deleted`, `typing.started/stopped`, and `notification.created` for mention recipients. Events are emitted after committed writes; typing is not persisted.

### Security Impact

Task room joins resolve board/workspace access. Viewer can read but cannot post; only an editor who authored a comment can edit/delete. Mention addresses must be current workspace members. Comments are rendered as text, so HTML content is escaped. Rejected joins disclose no task details.

### Tests Added or Updated

- Task integration suite covers outsider/viewer denial, invalid mention, successful mention notification, author ownership, stale version, list visibility, and soft deletion.
- Realtime suite covers unauthorized task join, comment/mention delivery, typing start/stop, and socket eviction after task archive.

### Tests Run

- Prisma migration deployed locally and client generated.
- Biome format/lint and API/web TypeScript: passed.
- Full serial API integration suite: 6/6 passed.
- API TypeScript production build and Next.js production build: passed.
- Authenticated browser discussion not run because live Supabase configuration is absent.

### Known Problems

Mention notifications are stored and emitted, but the user inbox/read UI belongs to Phase 11. Typing timers and socket event fanout are local to one API process; cross-instance delivery is deferred to Phase 16. No durable outbox/replay exists. Authenticated visual QA remains blocked by absent Supabase credentials. Activity history, files, search, and deployment remain.

### Technical Debt Introduced

Task page loads at most 500 comments across ten pages and refreshes the whole server page on comment events. A scoped comment cache can reduce work for busy discussions. Mention handles use full member email for an unambiguous identity; a friendly username system could be added after usernames have a uniqueness rule.

### Architecture Decisions

Comments are durable PostgreSQL truth, while typing is ephemeral. Email-form mentions are resolved against workspace membership within serializable comment transactions. Only newly added mentions on edit create new notification records. Task WebSocket room access follows task ancestry and is revoked on archive/removal.

### tech.nmd Updated?

Yes; data model, API, socket events, authorization, notification scope, and phase status updated.

### Current Project State After This Change

Phases 0–9 are locally implemented and tested. Main is pushed through Phase 8; this Phase 9 change is ready to commit and push. The app still needs live provider configuration and remaining roadmap features.

### Next Recommended Task

Implement Phase 10 durable activity history and a scoped workspace/task feed.

## [2026-09-24] Change ID: PROC-010

Author: Codex
Branch: main
Planned Commit Message: `feat(activity): add scoped task and workspace history`

### Summary

Implemented Phase 10 activity records and paginated task/workspace feeds. Current members can see an actor, action, time, and relevant details for changes in their workspace.

### Reason

Collaborators need a durable trail to understand who changed a task or workspace and when. Feed access must follow current membership and task ancestry.

### Features Added

- PostgreSQL `ActivityEvent` records for workspace, membership, project, board, task, and comment actions.
- Membership-scoped workspace and task activity APIs with validated cursors and 50-entry pages.
- Task and workspace activity panels with pagination and an unavailable state if the feed request fails.
- Integration checks for outsider denial and authorized actor/action visibility.

### Features Modified

- Successful mutation controllers record activity after the primary write. Logging failure is warned and does not turn a completed mutation into an API error.
- README, architecture spec, and audit now describe Phase 10 and its delivery limit.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and two migrations; new activity API module; workspace, project, task, and comment controllers; task integration test; task/workspace pages, activity component, web types/styles; README, audit, `tech.nmd`, and this log.

### Database Changes

Applied `20260924043203_activity_history` and `20260924043447_activity_actions` locally. `activity_events` stores actor, workspace/project/task scope, event type, metadata, and UTC creation time, with workspace/task feed indexes and foreign keys. Hard-deleted task records retain their workspace history by clearing the task foreign key.

### API Changes

Added `GET /api/v1/workspaces/:workspaceId/activity` and `GET /api/v1/tasks/:taskId/activity`. Both return up to 50 events and a `nextCursor`; unauthorized or inactive scope resolves to 404. Mutations now create records for the principal workspace, project, board, task, and comment actions.

### WebSocket Changes

- None. Activity panels load canonical API data on page render; live activity notifications are deferred.

### Security Impact

The server derives the actor from the verified token and resolves the event scope from stored ancestry. Feed reads require current workspace membership; task reads also require an active task, project, and workspace. Cursors must belong to the requested feed scope.

### Tests Added or Updated

- Task integration suite checks task/workspace activity visibility, event content, and outsider denial.

### Tests Run

- Both Phase 10 migrations deployed locally and Prisma client generated.
- Biome format/lint and API/web TypeScript: passed.
- Full serial API integration suite: 6/6 passed.
- API production TypeScript build and Next.js production build: passed before the final best-effort lookup guard; the guard passed typecheck and the full integration suite afterward.
- Authenticated browser activity UI not tested because Supabase project credentials are absent.

### Known Problems

Activity writes are best effort after primary commits, so a transient failure can leave a gap. The history does not yet cover every invitation and project edit action. The feed does not update live without a page refresh. Notification inbox, attachments, search, live provider validation, and production deployment remain.

### Technical Debt Introduced

A transactional outbox or an in-transaction append is needed for complete audit delivery. Feed pages stop after ten pages in the current web view; a dedicated client data layer will be needed for very long histories.

### Architecture Decisions

PostgreSQL is authoritative for activity, and an event stores both the durable entity ID and optional live foreign keys. Task hard deletion preserves the workspace record while clearing the task relation. Activity write failures remain observable in server logs without misreporting the already committed primary mutation.

### tech.nmd Updated?

Yes; data model, API, status, limits, and remaining work updated.

### Current Project State After This Change

Phases 0–10 are locally implemented and tested. Phase 10 is ready to commit and push. Live two-user browser QA awaits Supabase configuration, and GitHub CI has not been verified.

### Next Recommended Task

Implement Phase 11 notification inbox and read state.

## [2026-09-24] Change ID: PROC-011

Author: Codex
Branch: main
Planned Commit Message: `feat(notifications): add inbox and action alerts`

### Summary

Added a member-scoped notification inbox, unread count, read controls, and durable notification events for comments, new assignments, and role changes alongside mentions. Scheduled due-date reminders and invitation email delivery remain open.

### Reason

Recipients need a place to find and clear collaboration alerts. A notification ID alone must never grant access to another user's data.

### Features Added

- Paginated 50-item inbox, unread count, idempotent single read, and mark-all-read APIs.
- `/app/notifications` page with links to active tasks or workspaces, unread state, pagination, and error/empty states; dashboard navigation displays unread count.
- Assignment notices only for newly assigned members, comment notices for task creator/assignees who were not mentioned, and role-change notices for the affected member.
- Best-effort `notification.created` socket hints for the new action types.

### Features Modified

- Notification task/comment foreign keys are optional to support workspace-only role events.
- Existing mention notifications appear in the inbox with read state.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and migration, notifications API module, task/comment/workspace services and controllers, realtime publisher, API integration tests, dashboard and notification page/actions/types/styles, README, audit, `tech.nmd`, and this log.

### Database Changes

Applied `20260924044609_notification_inbox_types` locally. `NotificationType` now includes `ASSIGNMENT`, `COMMENT`, and `ROLE_CHANGED`; `task_id` and `comment_id` are nullable. Notification records for assignment, comment, and role actions are created in the same database transaction as the primary mutation.

### API Changes

Added `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:notificationId/read`, and `POST /api/v1/notifications/read-all`. The list has `items`, `nextCursor`, and `unreadCount`.

### WebSocket Changes

`notification.created` can now signal mention, assignment, comment, and role-change types to authorized user rooms after commit. The inbox currently refreshes on navigation rather than subscribing directly.

### Security Impact

List/count/read queries derive the recipient from the verified token and require current membership in a non-archived workspace. Outsiders receive 404 for a notification ID. Comment recipients are deduplicated against mentions and exclude the author. Former members no longer see their old workspace's alerts.

### Tests Added or Updated

- Task integration checks inbox visibility, outsider read denial, read idempotency, unread count, mark-all, and comment/assignment notices.
- Workspace integration checks a role-change notice for the affected member.

### Tests Run

- Prisma migration deployed locally and client generated.
- Biome format/lint and API/web TypeScript: passed.
- Full serial API integration suite: 6/6 passed after fixing a test fixture variable.
- API TypeScript production build and Next.js production build: passed.
- Authenticated browser inbox not tested because Supabase project credentials are absent.

### Known Problems

Due-date reminders need a scheduled, idempotent worker; invitation delivery needs an email provider and recipient flow. Inbox changes do not appear until navigation or refresh. Hard deletion of a task cascades its task notifications. Live provider UI, attachments, search, and production deployment remain.

### Technical Debt Introduced

The web inbox loads at most 500 entries across ten pages. The notification count query relies on recipient and workspace indexes; measure query plans before scaling. Socket publication remains best effort and does not replay missed hints.

### Architecture Decisions

PostgreSQL owns durable notifications; socket messages are refresh hints. Mutation-linked notifications are inserted within the same transaction as task/comment/role changes. Inbox visibility is recomputed from current membership for every request rather than relying on membership at creation time.

### tech.nmd Updated?

Yes; models, API, socket catalog, notification architecture, status, and limits updated.

### Current Project State After This Change

Phases 0–10 and Phase 11 inbox/core event paths are locally implemented and tested. Phase 11 is not complete until due-date scheduling and invitation delivery are decided and implemented. GitHub CI and live two-user browser QA remain unverified.

### Next Recommended Task

Build an idempotent due-date reminder worker and configure invitation email delivery, then proceed to Phase 12 attachments.

## [2026-09-24] Change ID: PROC-012

Author: Codex
Branch: main
Planned Commit Message: `feat(notifications): schedule deduplicated due reminders`

### Summary

Added an API worker that creates inbox reminders for current assignees of active tasks due in the next 24 hours or recently overdue, with database-enforced deduplication.

### Reason

Repeated scans and multiple API instances must not flood recipients with the same reminder. A member who was removed must not receive a new task alert.

### Features Added

- A due reminder scan at API startup and every 15 minutes, covering tasks due within 24 hours or overdue by less than 24 hours so short deadlines are not missed between scans.
- Unique reminder keys per task, exact due time, and recipient; a due-date change can generate a fresh reminder.
- Task due-date index and a system `DUE_SOON` notification type, rendered in the inbox.
- Integration test runs the worker twice and confirms one reminder.

### Features Modified

- `Notification.actorId` is nullable for system notices. The inbox renders system reminders without a person actor.
- README, architecture spec, audit, and current status describe the new delivery behavior.

### Features Removed

- None.

### Files / Modules Affected

- Prisma schema and two migrations, notifications module/worker, notification web type/page, task integration test, README, audit, `tech.nmd`, and this log.

### Database Changes

Applied `20260924045400_due_reminder_dedup` and `20260924045500_due_task_index` locally. Notifications gain `DUE_SOON`, nullable `actor_id`, and a unique nullable `dedupe_key`; tasks gain `(due_at, id)` index.

### API Changes

- No new route. Existing inbox routes show the new type.

### WebSocket Changes

- No new event. Scheduled reminders appear after inbox refresh; the worker does not emit socket hints.

### Security Impact

The scan includes only non-archived, non-completed tasks in active projects/workspaces and intersects assignees with current workspace memberships. Inbox authorization remains recipient and membership scoped.

### Tests Added or Updated

- Task integration suite sets a due date, scans twice, checks a single `DUE_SOON` record, then moves the deadline five minutes into the past and verifies one fresh reminder for the changed due time.

### Tests Run

- Both migrations deployed locally and Prisma client generated.
- Biome format/lint and API/web TypeScript: passed.
- Full serial API integration suite: 6/6 passed.
- API TypeScript production build and Next.js production build: passed.
- Live authenticated browser UI not tested because Supabase project credentials are absent.

### Known Problems

The worker scans every 15 minutes; a reminder can appear late by that interval and only in the inbox. Deadlines overdue by more than 24 hours do not get a reminder. Invitation email delivery remains unavailable without a provider. A task hard delete removes its related reminder rows by foreign-key cascade. Activity logging and sockets remain best effort.

### Technical Debt Introduced

The worker processes due tasks in 100-task transactions. Query performance and scan duration need production measurement. A dedicated job process may replace the in-API timer as scale grows. No email/push channel exists for reminders.

### Architecture Decisions

The database unique key is the cross-instance deduplication boundary; `createMany(skipDuplicates)` makes repeat scans harmless. The worker uses a fixed UTC scan window per run and current membership at insertion time. System notices have no human actor.

### tech.nmd Updated?

Yes; notification model, scan behavior, current status, and delivery limits updated.

### Current Project State After This Change

Phase 11 inbox, core action alerts, and due reminders are locally implemented and tested. Invitation email delivery remains open, so Phase 11 as a whole is not marked complete. Phase 12 attachments and later roadmap work remain.

### Next Recommended Task

Configure an invitation email provider or proceed to Phase 12 private attachments.

## [2026-09-24] Change ID: PROC-013

Author: Codex
Branch: main
Planned Commit Message: `feat(search): add scoped task full-text search`

### Summary

Implemented Phase 13 workspace-scoped task search over titles and descriptions, with project, assignee, and priority filters and a dedicated search page.

### Reason

Members need to find work beyond the currently open board. The database index must not allow cross-workspace or archived content to leak through search.

### Features Added

- PostgreSQL GIN expression index for task title/description full-text documents.
- Member-authorized search API with parameterized query, relevance order, filters, and 20-result pages.
- Workspace search entry and full search page with filters, task links, empty/error states, and pagination.

### Features Modified

- README, architecture spec, audit, and current status now describe task search and its limits.

### Features Removed

- None.

### Files / Modules Affected

- Search index migration, new API search module, AppModule, task integration test, workspace page, search page, web API types/styles, README, audit, `tech.nmd`, and this log.

### Database Changes

Applied `20260924050100_task_search_index` locally. It creates a GIN index on a `simple` full-text document built from task title and description; no Prisma model change is required.

### API Changes

Added `GET /api/v1/workspaces/:workspaceId/search?q=...` with optional `projectId`, `assigneeId`, `priority`, and page 1–10. Returns up to 20 task matches and `hasMore`. Search query is 2–100 characters.

### WebSocket Changes

- None. Search reads authoritative PostgreSQL state on navigation.

### Security Impact

Search first verifies current membership in an active workspace. Parameterized SQL joins task ancestry and excludes archived tasks/projects/workspaces. Input validation limits query size and filter values. Task descriptions render as escaped text in React.

### Tests Added or Updated

- Task integration checks outsider 404, short query 400, member result, project/priority filters, and exclusion after task archive.

### Tests Run

- Search index migration deployed locally.
- Full serial API integration suite: 6/6 passed.
- Biome format/lint, API/web TypeScript, API production build, and Next.js production build: passed.
- Authenticated browser search UI not tested because Supabase project credentials are absent.

### Known Problems

Search covers task title/description only and stops at page 10. It does not search comments, files, project descriptions, or archived tasks. Live provider UI remains unverified. Phase 12 private attachments and invitation email delivery still need storage/email providers.

### Technical Debt Introduced

The expression index is maintained in SQL migration rather than Prisma schema because Prisma cannot represent this full-text expression. Search uses offset pages and may shift under concurrent edits; use keyset pagination if results grow substantially. Measure query plans with real data before adopting dedicated search infrastructure.

### Architecture Decisions

PostgreSQL full-text search with `simple` tokenization is sufficient for this scope. The API binds all user values and applies workspace ancestry within the query after a membership check. Search result URLs point only to tasks still active when read.

### tech.nmd Updated?

Yes; data/API/search architecture, status, and limits updated.

### Current Project State After This Change

Phases 0–10, Phase 11 inbox/core alerts/reminders, and Phase 13 task search are locally implemented and tested. Phase 12 attachments, Phase 11 invitation delivery, and production validation remain.

### Next Recommended Task

Configure private object storage for Phase 12 or continue Phase 14 security/performance/accessibility hardening.

## [2026-09-24] Change ID: PROC-014

Author: Codex
Branch: main
Planned Commit Message: `feat(security): throttle invitations and set browser headers`

### Summary

Started Phase 14 hardening with Redis-backed limits for invitation creation and acceptance, clearer user feedback for 429/503 responses, and basic browser security headers on web/API responses.

### Reason

High-entropy invitation tokens still need an abuse boundary to protect database load. Browsers should receive explicit framing, MIME, referrer, and device-permission policies.

### Features Added

- Atomic fixed-window Redis counters: 20 invitation creations per verified account/workspace/hour and 10 token acceptance attempts per verified account/five minutes.
- HTTP 429 for excess requests; invitation routes return 503 if Redis cannot enforce their limit.
- Web and API headers for `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- UI feedback distinguishes rate limit and temporary invitation-service failure.

### Features Modified

- Invitation controllers check limits after input validation and before the underlying operation.
- README, architecture spec, audit, and current status describe these controls.

### Features Removed

- None.

### Files / Modules Affected

- New rate-limit API module, AppModule, workspace/invitation controllers, API bootstrap, workspace integration test, Next config, web invitation actions/dashboard, README, audit, `tech.nmd`, and this log.

### Database Changes

- None. Counters are ephemeral Redis keys.

### API Changes

Invitation create/accept can now return 429 or 503. All other response shapes are unchanged.

### WebSocket Changes

- None.

### Security Impact

Counters use the verified JWT subject, with workspace scope for link creation, and are atomic across API instances. Redis failure blocks these sensitive routes rather than allowing unlimited attempts. Browser headers reduce MIME sniffing, framing, referrer exposure, and accidental device permission use. This does not replace a full CSP or deployment review.

### Tests Added or Updated

- Workspace integration suite sends ten invalid token attempts and verifies the eleventh returns 429.

### Tests Run

- Full serial API integration suite: 6/6 passed after rate-limit wiring.
- Biome format/lint, API/web TypeScript, API production build, and Next.js production build: passed.
- Local web and API servers returned HTTP 200 with all four security headers verified using HEAD requests.
- Desktop login page visually inspected at localhost:3100; account fields are disabled without Supabase configuration. Authenticated UI remains untested.

### Known Problems

Fixed windows allow a burst across a window boundary; Redis is required for invitation actions. The app has no CSP yet. Phase 12 attachments, invitation email delivery, live auth QA, and production deployment remain.

### Technical Debt Introduced

The rate-limit service opens its own Redis connection; a shared Redis provider could reduce connections. Limits are by account, so a distributed attacker with many accounts could still generate load; add IP/network controls at the edge during deployment.

### Architecture Decisions

Redis Lua performs increment and expiry atomically. Invitation routes fail closed when enforcement is unavailable. Header policy avoids a speculative CSP that could break OAuth or WebSocket until their live origin configuration can be tested.

### tech.nmd Updated?

Yes; Redis, security requirements, and current status updated.

### Current Project State After This Change

Phase 14 hardening is underway. Phases 0–10, Phase 11 inbox/alerts/reminders, and Phase 13 task search remain locally tested. Phase 12 private attachments and Phase 11 invitation email delivery remain open.

### Next Recommended Task

Audit remaining API security/performance/accessibility risks and configure private object storage for attachments.

## [2026-09-24] Change ID: PROC-015

Author: Codex
Branch: main
Planned Commit Message: `fix(ci): use manifest pnpm version`

### Summary

Investigated remote GitHub Actions failures and removed the conflicting pnpm version input from the checks workflow.

### Reason

All recent `checks` jobs failed in `pnpm/action-setup@v4` before dependency installation. The workflow requested pnpm `10`, while `package.json` pins `pnpm@10.17.1`. The action rejects mismatched version declarations.

### Features Added

- None.

### Features Modified

- CI uses the exact pnpm version from `packageManager` in the repository manifest.
- Current status and audit now reflect the observed remote failure and verification requirement.

### Features Removed

- Redundant `version: 10` workflow input.

### Files / Modules Affected

- `.github/workflows/ci.yml`, audit, `tech.nmd`, and this log.

### Database Changes

- None.

### API Changes

- None.

### WebSocket Changes

- None.

### Security Impact

- The checks job can now proceed to installation, tests, and builds; process-history validation was already green. No permissions or secrets changed.

### Tests Added or Updated

- None; the GitHub runner is the required verification for this workflow fix.

### Tests Run

- GitHub API confirmed the `checks` job failed at pnpm setup for recent commits, while the `process` job passed.
- Official `pnpm/action-setup` source confirms it rejects a workflow `version` that differs from `packageManager`.
- A new GitHub Actions run must complete after push.

### Known Problems

The checks job may reveal later failures after pnpm setup is repaired. Supabase credentials and storage/email providers remain absent for live QA and later features.

### Technical Debt Introduced

- None.

### Architecture Decisions

Use one authoritative pnpm pin in `package.json`; let the action read it rather than declaring a second version.

### tech.nmd Updated?

Yes; current CI status and verification requirement updated.

### Current Project State After This Change

CI setup is corrected in source. A passing remote run remains to be verified.

### Next Recommended Task

Inspect the new GitHub Actions run and fix any downstream failures it reveals.

## [2026-09-24] Change ID: PROC-016

Author: Codex
Branch: main
Planned Commit Message: `docs(process): record passing GitHub CI`

### Summary

Verified the first complete passing GitHub Actions run after the pnpm setup fix and updated project status.

### Reason

Local tests alone did not prove the hosted PostgreSQL/Redis services, migrations, checks, integration suite, and production builds work together on the GitHub runner.

### Features Added

- Recorded remote CI evidence: run `36041208853` for commit `af4647b` completed with a successful `checks` job and successful `process` job.

### Features Modified

- Current status, architecture status, and audit finding now reflect remote CI success.

### Features Removed

- Stale claim that CI was unverified.

### Files / Modules Affected

- `process.md`, `tech.nmd`, and audit document.

### Database Changes

- None.

### API Changes

- None.

### WebSocket Changes

- None.

### Security Impact

- Remote checks now cover the current code path, including authentication integration tests and process-history validation.

### Tests Added or Updated

- None; this entry records completed remote verification.

### Tests Run

- GitHub Actions run `36041208853` completed successfully. Its checks job passed installation, Prisma generation/migrations, `pnpm check`, `pnpm test:integration`, and `pnpm build`; its process job passed the history guard.

### Known Problems

Live Supabase/Google browser flows, private attachments, invitation email delivery, and production deployment remain unverified or unimplemented.

### Technical Debt Introduced

- None.

### Architecture Decisions

- Keep the manifest as the single pnpm version source and use hosted CI results as the deployment readiness gate alongside local checks.

### tech.nmd Updated?

Yes; current development and known-issues status updated.

### Current Project State After This Change

GitHub CI has a verified passing run for `af4647b`. This documentation-only update remains to be pushed.

### Next Recommended Task

Configure private object storage for Phase 12 attachments and supply live Supabase configuration for end-to-end QA.

## [2026-09-24] Change ID: PROC-017

Author: Codex
Branch: main
Planned Commit Message: `feat(files): add private task attachments`

### Summary

Implemented Phase 12 task attachments with private signed storage URLs, task-scoped authorization, finalization checks, a task-page file panel, and permanent task cleanup.

### Reason

The app had no way to attach documents to shared tasks. Upload and download need the same workspace access checks as task data and must not expose server storage credentials.

### Features Added

- `Attachment` metadata with pending and ready states, upload and download signing, server-side storage metadata verification, deletion, and a 20-file task limit.
- Task file panel supporting browser upload, member downloads, uploader/admin deletion, status messages, and direct upload to a private bucket.
- Attachment API integration coverage for viewer/editor/owner/outsider access, pending visibility, finalization, download, and deletion.

### Features Modified

- Task permanent deletion now attempts to remove associated storage objects after deleting the task record.
- API configuration now accepts a server-only storage credential and a private bucket name; empty local bucket configuration uses the documented default.
- README and architecture documentation describe bucket setup and current verification limits.

### Features Removed

- None.

### Files / Modules Affected

- `apps/api/src/attachments`, Prisma schema and migration, task controller/module, API configuration and integration test; task page, file actions/panel, download route, web types/styles; environment example, lockfile, README, audit, and architecture notes.

### Database Changes

- Added and locally applied `20260924183310_private_attachments` for `attachments` and `AttachmentStatus`. The migration also aligns the existing notification actor foreign key with the current nullable Prisma relation. The attachment path is unique and task/status/date lookup is indexed.

### API Changes

- Added `GET /tasks/:taskId/attachments`, `POST /tasks/:taskId/attachments/upload-url`, `POST /tasks/:taskId/attachments/:attachmentId/finalize`, `GET /attachments/:attachmentId/download-url`, and `DELETE /attachments/:attachmentId` under `/api/v1`.

### WebSocket Changes

- None; file mutations appear after page refresh.

### Security Impact

- Service-role key remains API-only. The API rejects public or overly permissive buckets, restricts MIME and size, checks workspace lineage on each request, hides pending uploads, and signs downloads only for current members. Upload requests are rate-limited in Redis. Signed URLs are bearer capabilities and must not be logged or cached.

### Tests Added or Updated

- Extended task integration test with file RBAC, metadata finalization, pending invisibility, signed download, and deletion using a fake storage adapter. No real Supabase bucket is configured.

### Tests Run

- Biome format and lint: passed on 108 files.
- API and web TypeScript checks: passed.
- Governance tests: 2 passed; API unit tests: 3 passed; web unit test: 1 passed.
- Full API integration suite: 6 passed with local PostgreSQL and Redis.
- Prisma schema validation, API production build, and Next.js production build: passed.
- Live Supabase Storage upload/download and authenticated browser UI: not run because project URL, publishable key, and service-role key are unavailable.

### Known Problems

- Pending metadata and objects left by abandoned or failed uploads need a reconciliation job. Object cleanup after permanent task deletion is best effort and can leave an orphan after a storage outage. Bucket CORS and browser upload need live verification. Invitation email delivery remains absent.

### Technical Debt Introduced

- Add background reconciliation for stale pending records and orphaned objects, and durable cleanup retries. Consider event hints for file changes once live bucket behavior is proven.

### Architecture Decisions

- PostgreSQL controls attachment visibility; a signed upload alone does not publish a file. Browser uploads file bytes directly to private storage, while API verifies the stored object and authorizes each metadata operation. The storage service rejects unsafe bucket settings before signing.

### tech.nmd Updated?

Yes; file model, API, storage architecture, and environment variables updated.

### Current Project State After This Change

Phase 12 is implemented and locally tested with a fake storage adapter. Real bucket and authenticated browser checks remain blocked by missing Supabase configuration. Commit, push, and remote CI verification are pending for this entry.

### Next Recommended Task

Configure a private bucket and Supabase Auth, then test the full signed upload/download journey in a browser and review remote CI.

## [2026-09-24] Change ID: PROC-018

Author: Codex
Branch: main
Planned Commit Message: `docs(process): record Phase 12 CI result`

### Summary

Confirmed the pushed Phase 12 commit passed GitHub Actions and corrected stale roadmap status text.

### Reason

The Phase 12 entry was written before remote CI finished, and two `tech.nmd` sections still described attachments as unimplemented.

### Features Added

- Remote CI evidence: run `36043393464` for commit `2bb215a` completed successfully; both `checks` and `process` jobs passed.

### Features Modified

- Current status and known issues now distinguish locally implemented attachments from live Supabase Storage validation.

### Features Removed

- Stale statement that files were not implemented.

### Files / Modules Affected

- `process.md` and `tech.nmd`.

### Database Changes

- None.

### API Changes

- None.

### WebSocket Changes

- None.

### Security Impact

- Documentation still explicitly requires a private bucket, server-only service-role key, and live validation.

### Tests Added or Updated

- None.

### Tests Run

- GitHub Actions run `36043393464`: completed successfully, with both jobs green. Local validation is recorded in PROC-017.

### Known Problems

- No live Supabase Auth or Storage configuration; invitation email delivery, storage reconciliation, deployment, and multi-instance socket delivery remain open.

### Technical Debt Introduced

- None.

### Architecture Decisions

- Keep implementation status separate from live external-service validation.

### tech.nmd Updated?

Yes; current phase and known issues corrected.

### Current Project State After This Change

Phase 12 code is on `main` and remote CI is green. This documentation update remains to be committed and pushed.

### Next Recommended Task

Set up Supabase Auth and private Storage for live QA, then continue remaining product and operations work.

## [2026-09-24] Change ID: PROC-019

Author: Codex
Branch: main
Planned Commit Message: `feat(realtime): fan out socket rooms through Redis`

### Summary

Added the Socket.IO Redis adapter so authenticated room events and remote socket revocations reach clients connected to another API instance.

### Reason

The existing Redis presence lease worked across processes, but Socket.IO rooms and broadcasts were local. A member removed through one instance could remain connected to another instance, and task changes could miss remote viewers.

### Features Added

- Redis pub/sub Socket.IO adapter initialized before the API starts listening, with publisher and subscriber connections closed on shutdown.
- Two-instance integration coverage for task/comment/notification room events, member revocation, and presence behavior.

### Features Modified

- API startup requires Redis pub/sub connectivity. Documentation now describes cross-instance fanout and remaining best-effort delivery limits.

### Features Removed

- Single-process-only Socket.IO room delivery in production bootstrap.

### Files / Modules Affected

- API `main.ts`, new `realtime/redis-io.adapter.ts`, realtime integration test, package manifest/lockfile, README, architecture, audit, and process documentation.

### Database Changes

- None.

### API Changes

- No REST contract changes.

### WebSocket Changes

- Socket.IO room broadcasts and `disconnectSockets` now use a shared Redis adapter across API instances. WebSocket-only clients already satisfy the load balancer transport requirement.

### Security Impact

- Membership removal and task/project/workspace revocations can disconnect sockets on another instance, reducing stale authorized subscriptions. A Redis outage after startup can still interrupt delivery; clients refetch canonical REST data on reconnect.

### Tests Added or Updated

- Realtime integration test now launches two Nest API instances, connects viewers to the second, performs mutations on the first, and verifies remote delivery and revocation.

### Tests Run

- Biome format and lint: passed on 109 files; API/web typechecks passed.
- Governance tests: 2 passed; API unit tests: 3 passed; web unit test: 1 passed.
- Full API integration suite: 6 passed with local PostgreSQL and Redis, including the two-instance test.
- API and Next.js production builds passed.
- Remote GitHub Actions for this commit: pending.

### Known Problems

- Socket publication remains best effort after REST writes, with no durable replay. Redis interruption after startup can lose room events. Live Supabase authentication and real storage upload remain unverified.

### Technical Debt Introduced

- Add a durable event outbox or replay if stronger delivery guarantees are required. Deployment needs shared Redis and WebSocket-capable ingress.

### Architecture Decisions

- Use the official Socket.IO Redis adapter with existing `ioredis` clients. Fail startup when Redis pub/sub cannot connect rather than serve a multi-instance realtime feature that silently fragments.

### tech.nmd Updated?

Yes; realtime, Redis, deployment, testing, current status, and ADR-003 updated.

### Current Project State After This Change

Phase 16 is implemented and locally verified across two API instances. This commit has not yet been pushed or checked by remote CI.

### Next Recommended Task

Verify GitHub Actions, then configure Supabase Auth and Storage for end-to-end QA and prepare deployment operations.

## [2026-09-24] Change ID: PROC-020

Author: Codex
Branch: main
Planned Commit Message: `docs(process): record Phase 16 CI result`

### Summary

Recorded the successful GitHub Actions run for Phase 16 and updated the current project status.

### Reason

The implementation entry was written before the hosted integration and build jobs finished.

### Features Added

- GitHub Actions run `36044422694` for commit `4becff6` completed successfully; `checks` and `process` jobs both passed.

### Features Modified

- Current status and technical specification now reflect remote Phase 16 verification.

### Features Removed

- Stale statement that Phase 16 CI was pending.

### Files / Modules Affected

- `process.md`, `tech.nmd`.

### Database Changes

- None.

### API Changes

- None.

### WebSocket Changes

- None.

### Security Impact

- Hosted integration checked remote socket revocation using two API instances.

### Tests Added or Updated

- None.

### Tests Run

- GitHub Actions run `36044422694`: completed successfully with installation, migration, checks, integration tests, production builds, and process-history guard.

### Known Problems

- Live Supabase Auth/Storage, invitation email delivery, deployment, and durable event replay remain open.

### Technical Debt Introduced

- None.

### Architecture Decisions

- Keep hosted CI outcomes in the chronological project handoff log.

### tech.nmd Updated?

Yes; current development phase text corrected.

### Current Project State After This Change

Phase 16 is on `main`, remotely verified, and this documentation update remains to be pushed.

### Next Recommended Task

Supply Supabase project configuration for live account and private file QA; prepare deployment runbooks and release gates.

## [2026-09-24] Change ID: PROC-021

Author: Codex
Branch: main
Planned Commit Message: `fix(audit): harden realtime rooms and refresh public experience`

### Summary

Audited the functional modules, authorization, public/auth UX, and production dependencies. Fixed stale task subscriptions, viewer typing, stale invitation redirects, a concurrent attachment quota race, and outdated public product messaging. Resolved the current production dependency advisories.

### Reason

Room navigation could retain an old task subscription, typing accepted viewers, a prior invitation could unexpectedly redirect later sign-ins, and the public page described implemented features as unfinished. Upload quota reservations could also race. The production dependency audit found nine transitive advisories.

### Features Added

- New public landing with accurate collaboration features and an account-unavailable state.
- `docs/audit-2026-09-24.md` with prioritized findings, UX assessment, product direction, test evidence, and release risks.
- Regression coverage for task-room navigation, viewer typing, concurrent upload reservations, and ordinary sign-in after an invitation.

### Features Modified

- Board/task socket transitions leave previous task rooms and stop typing; active typing checks current editor authorization.
- Login/signup middleware clears an old invitation destination unless the current request supplies a validated one.
- Upload reservations lock the task row and count pending plus ready attachments inside a transaction.
- Root pnpm overrides pin patched PostCSS, Multer, and deepmerge-ts versions.

### Features Removed

- Stale foundation marketing copy.

### Files / Modules Affected

- `apps/api/src/realtime/realtime.gateway.ts`, `apps/api/test/realtime.integration.test.ts`, `apps/api/src/attachments/attachments.service.ts`, `apps/api/test/tasks.integration.test.ts`, `apps/web/src/middleware.ts`, `apps/web/test/auth-next.unit.test.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/audit-2026-09-24.md`, `tech.nmd`, and `process.md`.

### Database Changes

None.

### API Changes

No REST contract changes. Upload quota is enforced atomically on all pending and ready reservations.

### WebSocket Changes

Navigation away from a task now removes its room membership; active typing requires editor access to the current task board.

### Security Impact

Closes stale task event delivery and viewer typing authorization gaps. Concurrent uploads can no longer exceed the task quota. Patched production dependencies and reran audit. Invitation destination cookies no longer carry into unrelated sign-ins.

### Tests Added or Updated

- Realtime integration assertions for viewer typing and old-task room delivery after board navigation.
- Web unit test for invitation destination clearing.
- Task integration test races 21 upload requests and expects exactly 20 successful reservations.

### Tests Run

- `pnpm check`: passed; format/lint and API/web typechecks passed, 2 governance, 3 API unit, and 2 web unit tests passed.
- `pnpm test:integration`: 6 passed against local PostgreSQL/Redis.
- `pnpm build`: API and Next.js production builds passed.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities at audit time.
- Browser: inspected public landing and login in local development mode; signed-in and mobile screens were not verified.
- Remote GitHub Actions for this commit: pending at log creation.

### Known Problems

Supabase Auth and private Storage are not configured, so live account, Google OAuth, authenticated UI, and real upload flows remain untested. Abandoned uploads need cleanup and can consume quota. Email delivery, deployment, and durable event replay remain open.

### Technical Debt Introduced

The three transitive dependency overrides should be removed once upstream packages adopt patched versions. No new runtime feature debt was introduced.

### Architecture Decisions

Keep REST as durable data truth and require current editor authorization for transient typing. Use scoped pnpm overrides for vulnerable transitive packages while retaining current tested major framework versions. See the audit document for product priorities.

### tech.nmd Updated?

Yes; realtime subscription behavior, current verification, and known risks updated.

### Current Project State After This Change

Core collaboration modules and this audit patch pass local automated checks and builds. Full product release readiness still depends on external Supabase setup and signed-in/browser QA. This commit has not yet been pushed or checked by remote CI.

### Next Recommended Task

Configure Supabase Auth/Storage, run a two-user end-to-end pass, add upload reconciliation, and prepare deployment operations.

## [2026-09-24] Change ID: PROC-022

Author: Codex
Branch: main
Planned Commit Message: `docs(process): record audit CI result`

### Summary

Recorded the successful GitHub Actions result for audit commit `4f52a6f`.

### Reason

PROC-021 was written before the hosted workflow completed.

### Features Added

- GitHub Actions run `36047957027` completed successfully for the audit commit.

### Features Modified

- Current status and technical specification now reflect remote verification.

### Features Removed

- None.

### Files / Modules Affected

- `process.md`, `tech.nmd`.

### Database Changes

None.

### API Changes

None.

### WebSocket Changes

None.

### Security Impact

The hosted workflow verified the code and dependency lockfile with its checks, integration, and build jobs.

### Tests Added or Updated

None.

### Tests Run

- GitHub Actions run `36047957027`: completed successfully for commit `4f52a6f`.

### Known Problems

Live Supabase Auth/Storage, invitation email delivery, upload reconciliation, deployment, and durable event replay remain open.

### Technical Debt Introduced

None.

### Architecture Decisions

Keep remote CI outcomes in the chronological project handoff log.

### tech.nmd Updated?

Yes; remote audit verification reflected in the current development phase.

### Current Project State After This Change

The audit commit is on `main` and passed local and hosted automated checks. End-to-end product readiness still requires external Supabase configuration and signed-in browser QA.

### Next Recommended Task

Configure Supabase Auth and private Storage, perform two-user browser QA, then address upload reconciliation and deployment operations.
