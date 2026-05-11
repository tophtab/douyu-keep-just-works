# Clean Unused Dependencies and Files

## Goal

Clean repository contents that are already tracked in GitHub by removing files that are not part of the runtime, build, tests, documentation, or Trellis workflow, while preserving files with active references or operational value.

## What I Already Know

* The user asked to analyze unused libraries and files, then clean unnecessary content that has already been synced to GitHub.
* The working tree was clean before this task started.
* `package.json` production dependencies are all directly used by source files:
  * `axios` in core Douyu/CookieCloud/Yuba API modules.
  * `cron` in Docker cron/runtime modules.
  * `cron-parser` in Docker cron scheduling validation.
  * `express` in Docker WebUI server.
  * `ws` in gift collection WebSocket logic.
* Dev dependencies are used by lint, type-check, and TypeScript compile paths.
* `doc/海报.png` is referenced by `README.md` and should remain.
* Ignored local artifacts exist (`dist/`, `config/`, `node_modules/`, `.trellis/.backup-*`) but they are not Git-tracked GitHub content and are out of scope unless explicitly requested.

## Requirements

* Remove tracked files that are demonstrably unused by source, tests, CI, Docker, docs, or Trellis runtime.
* Do not remove dependencies that are imported or used by project scripts/tooling.
* Do not remove README-linked documentation assets.
* Do not clean ignored local runtime/build artifacts as part of the GitHub-content cleanup.
* Preserve Trellis task metadata for this cleanup task.

## Acceptance Criteria

* [x] Unused tracked backup files under `.agents/skills/*.backup` are removed.
* [x] `.agents/skills/*.backup` is ignored to prevent future accidental tracking.
* [x] Unused tracked template duplicates under `src/templates/markdown/spec/guides/` are removed if no references exist.
* [x] `package.json` and `package-lock.json` remain unchanged unless a truly unused dependency is found.
* [x] `npm run lint` passes.
* [x] `npm run type-check` passes.
* [x] `npm run test:contracts` passes.
* [x] `npm run build:docker` passes.
* [x] `git status --short` clearly shows only intended cleanup/task files.

## Definition of Done

* Evidence-based cleanup completed.
* Lint/type-check/test coverage appropriate to cleanup risk has run.
* No user-owned unrelated changes are reverted.
* Commit plan is presented before committing.

## Technical Approach

Use static reference searches, `git ls-files`, dependency import checks, and project scripts to distinguish tracked GitHub content from ignored local artifacts. Remove only files with no active references and no clear operational role.

## Decision (ADR-lite)

**Context**: The repository contains both tracked project files and ignored local artifacts. The user specifically mentioned content synced to GitHub, so tracked files are the cleanup target.

**Decision**: Limit destructive cleanup to tracked, unused files. Leave ignored local artifacts alone and report them separately.

**Consequences**: The GitHub repository gets cleaner without risking local runtime state such as `config/config.json` or generated build outputs.

## Out of Scope

* Removing local ignored folders/files such as `node_modules/`, `dist/`, `build/`, `config/`, and `.trellis/.backup-*`.
* Removing README-linked poster/image assets.
* Changing runtime behavior or dependency versions.

## Technical Notes

* `rg` found no references to `.agents/skills/*.backup`.
* `rg` found no references to `src/templates/markdown/spec/guides/*` outside the duplicate template content itself and the ESLint ignore entry.
* `.trellis/spec/guides/*` contains the active spec documents; `src/templates/markdown/spec/guides/*` appears to be an unused duplicate template copy.
* `npm ls --depth=0`, `npm run type-check`, and `npm run test:contracts` passed before cleanup.
* After cleanup, `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm run build:docker` passed.
* `.gitignore` now ignores `.agents/skills/*.backup` so generated backup copies do not return to GitHub.
