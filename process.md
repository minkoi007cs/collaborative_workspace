# SyncSpace Development Process

## Current Status

Current Phase: Phase 10 — Activity history (locally implemented and tested)
Current Milestone: Scoped task and workspace history with actor and action details
Current Branch: main
Current Focus: Phase 11 notification inbox and read state
Last Completed Feature: Paginated activity feeds for task and workspace actions, with membership checks and actor metadata
Current Known Issues: No Supabase project credentials; live email/Google sign-in and authenticated UI untested; no notification inbox; activity writes can leave gaps on postcommit failure; socket publication has no durable replay or multi-instance adapter; invitation email and archive restore absent; first GitHub CI run still needs review
Next Recommended Task: Implement Phase 11 notification inbox and read state

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
