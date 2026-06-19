# Review spec optimization

## Goal

Review the current `.trellis/spec/` corpus and decide how to reduce future
agent reading and maintenance cost without deleting still-live project
guardrails.

The user feels the current spec set is too large. The useful outcome is a
repository-backed optimization plan, not broad deletion by line count.

## Confirmed Facts

- This repo is a single-repo TypeScript/Vue Docker-first project with
  `.trellis/spec/` split into `backend`, `frontend`, and shared `guides`.
- Current `.trellis/spec/` has 19 Markdown files and about 2,590 lines.
- Largest files are:
  - `.trellis/spec/frontend/state-management.md` at 478 lines with 6 scenario
    contracts.
  - `.trellis/spec/backend/database-guidelines.md` at 298 lines with 3
    scenario contracts.
  - `.trellis/spec/backend/error-handling.md` at 205 lines with 1 scenario
    contract.
  - `.trellis/spec/backend/quality-guidelines.md` at 166 lines.
- `trellis-before-dev` requires agents to read relevant layer indexes and then
  specific checklist files; it also always reads shared guides.
- The backend/frontend index files list sensible trigger conditions, but the
  checklist format still makes large tasks gravitate toward many full-file
  reads.
- A previous archived task,
  `.trellis/tasks/archive/2026-06/06-07-cleanup-test-spec-redundancy/`,
  already found no Markdown clones in specs and recommended against deleting
  scenario docs solely because they are long.
- Current audit agrees: the main issue is not textual duplication; it is mixed
  responsibility between daily coding rules and accumulated scenario contracts.
- Existing scenario contracts cover high-risk behavior such as secrets,
  CookieCloud, Passport QR, Yuba SSO, force refresh, Docker build cache, and
  Vue-only WebUI boundaries.

## Requirements

- Identify optimization opportunities grounded in the current repository
  structure and prior task history.
- Preserve still-live guardrails for Docker-first behavior, secret boundaries,
  CookieCloud/Passport flows, Yuba SSO, cache refresh, config persistence, and
  Vue-only WebUI architecture.
- Apply all three optimization directions in a controlled order:
  1. improve routing/index discoverability,
  2. separate scenario contracts from daily guidelines where it lowers reading
     cost,
  3. compress scenario prose that is repetitive, stale, or better represented
     as concise contracts plus test references.
- If implementation is later approved, make small reversible edits with clear
  before/after rationale.
- Keep `.trellis/spec/` documentation in English if edited.

## Acceptance Criteria

- [x] PRD records current spec inventory, prior relevant history, and the main
  optimization hypothesis.
- [x] A research note summarizes candidate optimization approaches and their
  risks.
- [x] User chooses the intended optimization direction before implementation.
- [x] Complex planning adds `design.md` and
  `implement.md` before `task.py start`.
- [x] Any implementation preserves high-risk scenario contracts unless a
  specific section is shown stale or duplicated by stronger docs/tests.
- [x] Final spec set has clearer route-to-read guidance for common backend,
  frontend, and cross-layer work.
- [x] Final spec set reduces daily guideline bulk by moving or compressing
  scenario-heavy content.

## Out of Scope

- Deleting spec content solely because a file is long.
- Rewriting the Trellis workflow or skill system unless the chosen direction
  explicitly scopes loading-rule changes.
- Touching unrelated existing uncommitted Trellis workflow/skill changes.
- Changing application source code or tests as part of this planning step.

## Decision

Use the comprehensive route requested by the user: do routing/index cleanup,
scenario separation, and evidence-gated compression in one staged spec
optimization task.

## Implementation Summary

- Added `.trellis/spec/backend/contracts.md` and consolidated backend scenario
  contracts into it, including config/default ownership, manual passport
  material, credential recovery retry, Passport/main/Yuba authority, QR login
  snapshots, Douyu pocket double-card detection, Docker image cache, and task
  metadata ownership.
- Deleted standalone backend scenario files:
  `.trellis/spec/backend/auth-cookie-lifecycle.md` and
  `.trellis/spec/backend/douyu-pocket-contracts.md`.
- Added `.trellis/spec/frontend/contracts.md` and moved/compressed the
  scenario-heavy parts of frontend state management into it.
- Kept `.trellis/spec/frontend/state-management.md` as a daily state ownership
  and resource-pattern guide.
- Added read-routing tables to backend and frontend indexes.
- Compressed shared thinking guides while preserving concrete checklists and
  Trellis-specific gotchas.

## Verification

- `.trellis/spec` inventory: 19 Markdown files, 1,959 total lines.
- Previous inventory: 19 Markdown files, about 2,590 total lines.
- Reduction: about 631 lines while keeping the backend/frontend/guides layout.
- `git diff --check -- .trellis/spec .trellis/tasks/06-19-review-spec-optimization` passed.
- Deleted backend spec filenames have no current references in `.trellis/spec`,
  `.agents/skills`, or `.cursor/skills`.
- Optional `jscpd` duplicate scan was attempted twice; the first attempt failed
  with npm `ECONNRESET`, and the second produced no output for 90 seconds and
  was interrupted.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
