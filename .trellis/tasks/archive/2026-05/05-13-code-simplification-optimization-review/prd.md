# brainstorm: code simplification and optimization review

## Goal

Analyze the current frontend and backend code to identify practical simplification and optimization opportunities, with enough specificity that follow-up refactor tasks can be prioritized and implemented safely.

## What I already know

* User wants analysis only for now, covering both frontend and backend.
* User explicitly requested the main agent do the work and not open Subagents.
* Repository is Trellis-managed with backend and frontend spec layers.
* Current git working tree was clean before this task was created.
* Frontend is a Vue/Vite Docker WebUI still carrying transitional legacy bridges.
* Backend has a task metadata seed (`src/docker/task-metadata.ts`) but many task-specific branches remain hand-written.

## Assumptions (temporary)

* Output should be a concrete engineering review, not an immediate code change.
* Recommendations should distinguish low-risk cleanup from architectural refactors.
* The review should consider code deletion, deduplication, maintainability, runtime performance, and build/test friction where visible.

## Open Questions

* None yet. Inspect the repo first; ask only if a product or priority preference cannot be derived.

## Requirements (evolving)

* Inspect frontend code organization, major flows, duplication, state management, component structure, and build constraints.
* Inspect backend code organization, APIs/services, data flow, repeated patterns, error handling, and operational concerns.
* Produce prioritized simplification and optimization recommendations with likely impact and risk.
* Avoid Subagents.
* Persist concrete findings in a research artifact for future implementation tasks.

## Acceptance Criteria (evolving)

* [x] Frontend simplification opportunities are identified with file references.
* [x] Backend simplification opportunities are identified with file references.
* [x] Cross-layer simplification opportunities are identified where relevant.
* [x] Recommendations are prioritized into safe/near-term and larger follow-up work.
* [x] Findings are persisted in this task's `research/` directory and summarized to the user.

## Definition of Done (team quality bar)

* Findings are grounded in inspected repo files.
* No implementation changes are made unless the user asks for a follow-up implementation.
* Notes are detailed enough to seed implementation tasks.

## Out of Scope (explicit)

* Applying refactors in this turn.
* Performance benchmarking beyond static inspection unless an obvious local command is available and safe.
* External research; this request is primarily about the local codebase.

## Technical Notes

* Task directory: `.trellis/tasks/05-13-code-simplification-optimization-review`
* Relevant thinking guides: `.trellis/spec/guides/code-reuse-thinking-guide.md`, `.trellis/spec/guides/cross-layer-thinking-guide.md`
* Research artifact: `research/code-simplification-optimization.md`

## Research References

* [`research/code-simplification-optimization.md`](research/code-simplification-optimization.md) — Concrete frontend/backend simplification opportunities, risk tiers, and follow-up task suggestions.
