# 精简和优化前端代码

## Goal

Reduce duplicated Docker WebUI frontend code while preserving current behavior and UI. The first pass should target the largest low-risk duplication in task pages, so the codebase becomes easier to maintain without taking on a broad rewrite.

## What I already know

- The user asked why frontend files are still large and whether the frontend can be simplified and optimized.
- The user explicitly requested no subagents; implementation and checks should happen in the main Codex session.
- Current largest frontend files include `resources.ts`, `double.ts`, `expiring.ts`, `yuba.ts`, `cookie.ts`, and `keepalive.ts`.
- `double.ts` and `expiring.ts` share substantial task-page structure:
  - task config defaults and model normalization
  - fan allocation row construction
  - save/disable/trigger flows through shared `task-shared.ts`
  - cron preview handling
  - empty/status text computed from cookie/fans loading state
- Existing shared pieces already include `AllocationTable.vue`, `TaskStatusCard.vue`, `CronField.vue`, and helpers in `task-shared.ts`.

## Assumptions

- The first simplification pass should prefer behavior-preserving extraction over feature changes.
- Reducing meaningful duplication is more valuable than moving code only to make a single file shorter.
- The safest first target is shared allocation-task logic between `double.ts` and `expiring.ts`, not a full rewrite of `resources.ts`.

## Requirements

- Extract reusable frontend logic for allocation-based task pages where it reduces real duplication.
- Preserve current UI copy, event names, API endpoints, payload shapes, and legacy bridge behavior.
- Keep Docker WebUI source under `src/docker/webui-src/`.
- Do not introduce new frontend dependencies or UI frameworks.
- Do not use subagents for this task.

## Acceptance Criteria

- [x] `double.ts` and/or `expiring.ts` have less duplicated allocation-task code.
- [x] Extracted code has clear, typed boundaries and matches existing Vue composable/helper style.
- [x] Existing Vue pages continue to receive the same returned state/actions from their composables.
- [x] `npm run lint` passes.
- [x] `npm run type-check` passes.

## Definition of Done

- Frontend simplification is implemented in a focused, behavior-preserving way.
- Lint and type-check are green.
- Any relevant Trellis/spec decision is reviewed before wrap-up.

## Out of Scope

- Backend behavior changes.
- Visual redesign.
- Replacing the current Vue/Vite setup.
- Removing the entire legacy resource bridge in this pass.
- Broadly rewriting `resources.ts` unless it is needed for the selected refactor.

## Technical Notes

- Relevant source:
  - `src/docker/webui-src/double.ts`
  - `src/docker/webui-src/expiring.ts`
  - `src/docker/webui-src/task-shared.ts`
  - `src/docker/webui-src/components/AllocationTable.vue`
- Relevant specs:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/directory-structure.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/hook-guidelines.md`
  - `.trellis/spec/frontend/type-safety.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
