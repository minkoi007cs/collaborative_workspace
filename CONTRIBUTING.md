# Contributing to SyncSpace

## Before changing code

1. Read `tech.nmd`, `process.md`, and `AGENTS.md`.
2. Review Current Status and the latest entries relevant to your change; identify the milestone.
3. Inspect the code, tests, and Git status. Confirm the change follows the architecture.
4. Implement a focused change with validation, authorization, and tests where relevant.
5. Run the relevant checks and record what actually ran.
6. Update `process.md` using its entry template and refresh Current Status.
7. Update `tech.nmd` if architecture changed.
8. Review and stage the implementation and documentation together, then commit.

Use conventional commit subjects such as `feat(tasks): add version checks`. Never bypass the process check to land undocumented changes. A pull request must pass CI. Report setup or test limitations plainly.

## Local workflow

See `README.md` for setup. Branch from the default branch, keep changes focused, and avoid including generated files or secrets. The pre-commit hook is installed by `pnpm install` through the root `prepare` script. Run `pnpm check` before opening a pull request.
