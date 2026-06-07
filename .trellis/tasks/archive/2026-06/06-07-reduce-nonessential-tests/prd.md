# brainstorm: reduce nonessential test coverage

## Goal

Remove nonessential tests that over-constrain implementation details, so future UI and runtime refactors are not blocked by low-value assertions. Preserve tests that protect real behavior, security boundaries, Docker-first build guarantees, CookieCloud/Passport credential flows, and durable architecture guardrails.

## What I already know

* User wants unnecessary tests deleted to avoid over-testing.
* User was not satisfied with the previous `06-07-cleanup-test-spec-redundancy` outcome.
* The previous cleanup task selected a conservative "keep all coverage, reduce fixture redundancy" approach, which explains why it did not actually remove much test coverage.
* Current maintained tests are about 3,053 lines across `test/*.test.js`; the largest files are:
  * `test/douyu-passport-contract.test.js` at 869 lines.
  * `test/project-maintenance-contract.test.js` at 776 lines.
  * `test/server-route-guardrails-contract.test.js` at 424 lines.
* The highest-confidence over-testing hotspot is `test/project-maintenance-contract.test.js`, especially source-shape assertions that lock exact Vue module ownership, composable calls, CSS selectors, and copy details.
* `test/douyu-passport-contract.test.js`, `test/config-guardrails-contract.test.js`, and `test/server-route-guardrails-contract.test.js` mostly protect credential, config, route, and secret-boundary behavior. These are higher-risk deletion targets.
* The backend testing spec already distinguishes `Guardrail`, `Behavior`, `Shape`, and `Mixed`, and explicitly treats `Shape` tests as high-maintenance candidates for replacement or removal.

## Assumptions (temporary)

* "Nonessential" means low-value implementation-shape checks and duplicated proof of the same contract, not business-critical behavior tests.
* We should delete tests only when the remaining suite still protects the durable contract.
* We should not delete a test just because it is source-text based; source checks are still appropriate for forbidden legacy files, secret handling, and static Docker/build invariants.

## Open Questions

* None.

## Requirements (evolving)

* Remove over-specific test coverage that locks implementation details without protecting a durable contract.
* Preserve behavior-level coverage for config normalization, route auth/secret masking, credential recovery, CookieCloud/Passport, force refresh, and core task helpers.
* Remove most source-inspection maintenance tests, accepting that some static architecture guardrails are no longer tested directly.
* Use Approach C after the user reviewed Approach B and asked for a more aggressive cut.
* Keep runtime behavior unchanged.

## Acceptance Criteria (evolving)

* [x] PRD records why the previous cleanup missed the user's intent.
* [x] Low-value Shape/UI-source assertions are removed or narrowed.
* [x] Remaining tests still protect durable behavior and guardrails.
* [x] `npm run test:contracts` passes.
* [x] `npm run lint` passes for touched test files.
* [x] Type-check is run if source files are touched.

## Definition of Done (team quality bar)

* Tests removed or updated where appropriate.
* Lint / typecheck / CI-relevant checks are green.
* Docs/notes updated if behavior or spec guidance changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Runtime behavior changes.
* Test framework migration.
* Deleting credential recovery, auth masking, or config behavior tests just to reduce line count.
* Broad `.trellis/spec/**` compression unless a specific testing guideline correction is needed.
* Removing all source-text contract tests.

## Technical Notes

* Current task: `.trellis/tasks/06-07-reduce-nonessential-tests`
* Prior unsatisfactory task: `.trellis/tasks/archive/2026-06/06-07-cleanup-test-spec-redundancy/`
* Previous implementation commit: `029a489 test: reduce contract fixture redundancy`
* Prior task archive commit: `6268fa8 chore(task): archive 06-07-cleanup-test-spec-redundancy`
* Relevant spec: `.trellis/spec/backend/testing-guidelines.md`
* Likely primary target: `test/project-maintenance-contract.test.js`

## Feasible Approaches

### Approach A: Narrow Shape Tests Only (Recommended)

Delete or shrink the obvious over-specific Shape/UI-source assertions in `test/project-maintenance-contract.test.js`, while preserving guardrails for legacy WebUI deletion, Docker build wiring, Node alignment, and public secret boundaries.

Pros: directly fixes over-testing with low risk.
Cons: leaves business-critical behavior tests intact, so line-count reduction is moderate rather than maximal.

### Approach B: Shape Plus Mixed Block Pruning

Do Approach A, then also prune selected Mixed blocks where exact sequencing/import assertions duplicate behavior covered elsewhere.

Pros: larger reduction in source-shape noise.
Cons: higher risk of accidentally removing architecture intent before equivalent behavior coverage is confirmed.

Initially selected by user and implemented in commit `6bb397f`.

### Approach C: Aggressive Test Diet

Remove most source-inspection maintenance coverage and rely mainly on behavior tests, lint, type-check, and build.

Pros: biggest test-file reduction.
Cons: risks losing the guardrails that previously prevented legacy WebUI/runtime patterns, secret leaks, and Docker build regressions.

Selected by user after reviewing Approach B.

## Expansion Sweep

### Future evolution

* More WebUI refactors should be able to move composables/components without rewriting tests that only encode current file ownership.
* Testing guidance should keep a clear distinction between durable guardrails and temporary implementation-shape checks.

### Related scenarios

* Existing UI copy/styling tasks have left source checks behind; those should not become permanent locks unless they protect a product-critical contract.
* Backend credential and route tests are more valuable because regressions there can leak secrets or break real Douyu login/recovery flows.

### Failure / edge cases

* Deleting all source-text checks would weaken static architecture boundaries.
* Keeping every UI-source assertion makes harmless refactors noisy and encourages test churn.
* Removing behavior tests without replacement could let auth, config, or credential regressions pass.

## Decision (ADR-lite)

**Context**: The previous cleanup removed duplicate fixtures but intentionally kept all coverage, which did not address the user's concern about over-testing. The current suite's most obvious low-value coverage is concentrated in source-shape checks, especially UI ownership/copy/CSS assertions and selected Mixed blocks that lock exact wiring details.

**Decision**: Use Approach C after an intermediate Approach B commit. Delete most source-inspection maintenance coverage and rely mainly on executable behavior tests, lint, type-check, and build.

**Consequences**: This provides much lower refactor friction and a smaller test suite. It intentionally drops static guardrails around WebUI file ownership, source wiring, UI copy/CSS details, request-smoothing source shape, and project-maintenance source contracts. The retained suite still covers credential, auth/config, route, runtime cache, config normalization, and core task behavior.

## Technical Approach

1. Delete source-inspection-only maintenance tests.
2. Remove source-inspection helper code when no tests still use it.
3. Keep behavior tests that execute route handlers, TypeScript modules, config normalization, credential recovery, and core task helpers.
4. Run `npm run test:contracts`, `npm run lint`, `npm run type-check`, and `npm test`.

## Implementation Summary

* Approach B first reduced `test/project-maintenance-contract.test.js` from 776 lines to 379 lines in commit `6bb397f`.
* Approach C then removed the remaining source-inspection maintenance layer:
  * Deleted `test/project-maintenance-contract.test.js`.
  * Deleted `test/request-smoothing-contract.test.js`.
  * Deleted `test/webui-error-feedback-contract.test.js`.
  * Deleted unused `test/helpers/source-inspection.js`.
  * Removed the WebUI source-wiring assertion from `test/force-refresh-contract.test.js`, keeping only route/runtime-cache behavior tests.
* Current maintained test size is about 1,988 lines, down from about 3,053 before this task.
* Remaining tests focus on executable behavior: Passport/CookieCloud credential flows, route auth/config/secret behavior, config normalization/reconciliation, force-refresh route/cache behavior, core API sorting, gift task helpers, and Yuba sign behavior.

## Verification

* `npm run test:contracts` — 33 tests passed.
* `npm run lint`
* `npm run type-check`
* `npm test` — contract tests plus Docker/WebUI build passed.

## Spec Update Decision

No `.trellis/spec` update is needed. This task does not introduce a new API contract, storage behavior, or runtime rule. It is a deliberate task-level test-suite diet rather than a new general rule that future changes must delete source guardrails.
