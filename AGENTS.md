# SyncSpace contributor instructions

Before modifying code, read `tech.nmd`, `process.md` (including Current Status and the latest relevant history), and this file. Identify the current milestone, inspect the relevant implementation and tests, and check `git status`. Resolve any discrepancy between code and `tech.nmd`; do not silently choose one.

Implement within the documented architecture. Run relevant tests, record actual results and limitations in `process.md`, and update `tech.nmd` for every architecture change. Stage both code and documentation before committing. Every meaningful commit must include `process.md`; the hook and CI enforce this. Never claim unfinished or untested work is complete.

Prefer small, typed modules, server-side authorization, validated input, and explicit error handling. Do not commit secrets. Keep PostgreSQL authoritative for durable state and treat socket events as hints to refresh canonical data.
