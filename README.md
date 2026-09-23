# SyncSpace

SyncSpace is a planned real-time workspace and task collaboration platform. The repository currently contains governance, the Phase 1 foundation, Phase 2 authentication/profile flows, and Phase 3 workspace membership and invitations. Projects, boards, and collaborative tasks are not yet implemented.

## Architecture

```mermaid
flowchart LR
  B[Browser] --> W[Next.js web]
  W -->|REST| A[NestJS API]
  W -. future Socket.IO .-> A
  A --> P[(PostgreSQL)]
  A --> R[(Redis)]
```

PostgreSQL will hold durable product state. Redis will support ephemeral presence and cross-instance socket delivery. `tech.nmd` is the authoritative engineering specification and roadmap; `process.md` records what is actually implemented.

## Local development

Prerequisites: Node 20+, pnpm 10+, Docker Compose. Copy `.env.example` to `.env` and adjust values. The sample credentials are local development values only.

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

The Docker services use host ports 55432 (PostgreSQL) and 56379 (Redis) to avoid common local port conflicts.

For sign-up and login, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_URL` in `.env` to the same Supabase project. Enable email/password and Google in Supabase Auth, use an asymmetric JWT signing key, and allow `http://localhost:3000/auth/callback` as a redirect URL. The API verifies the provider's JWKS independently. Without this configuration, the account controls show an availability state. The login flow cannot be tested against a real provider until these values exist.

Signed-in users can create workspaces, invite teammates with a one-time link, and manage roles. Invitations are shared manually for now; email delivery is not implemented. The workspace owner can transfer ownership and archive the workspace. Archived workspaces cannot currently be restored in the UI.

Web: `http://localhost:3000`. API health: `http://localhost:3001/api/v1/health`. The database migration command requires Docker or a compatible PostgreSQL instance. Redis is checked during API startup.

## Checks

```bash
pnpm check
pnpm test:integration
pnpm build
```

`pnpm check` runs format, lint, typecheck, and unit tests. Integration tests need the local services. CI also verifies that each project commit updates `process.md`.

## Status

Current phase and limitations are maintained in `process.md`. The complete feature plan, security model, data model, event catalog, and decisions are in `tech.nmd`.
