# brainstorm: 清理测试和 spec 冗余

## Goal

Reduce meaningful redundancy in the current contract tests and Trellis specs so future refactors are less noisy, while preserving the guardrails that protect Docker-first behavior, secret boundaries, CookieCloud/Passport flows, and Vue-only WebUI architecture.

## What I already know

* User wants to clean up excessive redundancy in current tests and specs.
* The repo is a single-package Node 24 + TypeScript + Vue/Vite Docker-first app.
* Maintained tests live under `test/`; contract tests run via `npm run test:contracts`.
* Maintained specs live under `.trellis/spec/` with backend/frontend layers and shared thinking guides.
* Current git dirty state only contains this new Trellis planning task.
* A previous archived cleanup task already extracted `test/helpers/source-inspection.js`, narrowed some exports, and reduced broader source/test duplication.
* Current maintained tests total about 3,054 lines; largest files are `test/douyu-passport-contract.test.js`, `test/project-maintenance-contract.test.js`, and `test/server-route-guardrails-contract.test.js`.
* Current `.trellis/spec` docs total about 2,470 lines; largest files are `.trellis/spec/frontend/state-management.md` and `.trellis/spec/backend/database-guidelines.md`.
* `jscpd` found no markdown clones in `.trellis/spec`.
* `jscpd` found 7 JavaScript clones in tests, about 88 duplicated lines / 2.88%, concentrated in route setup, WebUI component file sets, cookie-source manager setup, and passport recovery fixtures.

## Assumptions (temporary)

* "Redundancy" means maintainability noise, not just clone-count reduction.
* We should not delete source-text contract tests without replacing them with equal or stronger guardrails.
* We should avoid broad spec deletion unless a section is demonstrably stale, duplicated elsewhere, or too implementation-specific for future guidance.

## Open Questions

* None.

## Requirements (evolving)

* Preserve existing behavior and architecture contract coverage.
* Reduce repeated test setup/fixtures where helpers improve readability without hiding contract intent.
* Keep source-inspection helpers focused on mechanics; do not hide architecture assertions behind generic helpers.
* Do not edit specs in this MVP except for task bookkeeping if a later quality step explicitly requires it.
* Do not delete `.trellis/.backup-*` directories unless separately scoped.
* Use Approach B: conservative test cleanup only.

## Acceptance Criteria (evolving)

* [x] PRD records scan evidence and selected cleanup scope.
* [x] Repeated test setup/fixtures in selected hotspot files are reduced or explicitly left unchanged with rationale.
* [x] Specs remain unchanged unless a later quality/spec-update step finds a necessary documentation correction.
* [x] `npm run test:contracts` passes after test changes.
* [x] Lint/type-check are run if touched files fall under those checks.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks are green.
* Docs/notes updated if behavior or spec guidance changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* No test framework rewrite.
* No deletion of contract tests solely because they inspect source text.
* No broad deletion of spec scenario docs solely because they are long.
* No cleanup of dependency or generated test/spec files under `node_modules`.
* No deletion of Trellis backup directories unless explicitly requested.

## Technical Notes

* Task directory: `.trellis/tasks/06-07-cleanup-test-spec-redundancy`
* Research scan: `research/test-spec-redundancy-scan.md`
* Relevant specs: `.trellis/spec/backend/testing-guidelines.md`, `.trellis/spec/guides/code-reuse-thinking-guide.md`, `.trellis/spec/backend/index.md`, `.trellis/spec/frontend/index.md`
* Prior related task: `.trellis/tasks/archive/2026-06/06-07-cleanup-code-redundancy/`

## Research References

* [`research/test-spec-redundancy-scan.md`](research/test-spec-redundancy-scan.md) — Local scan of maintained test/spec size, clone hotspots, and recommended conservative cleanup areas.

## Feasible Approaches

### Approach A: Audit only

* Keep this as a documented scan and do not implement cleanup now.
* Lowest risk, but leaves current test/spec noise in place.

### Approach B: Conservative test cleanup (Recommended)

* Add local helpers and named fixtures only in the three hotspot test files.
* Keep all contract assertions and source-text guardrails.
* Optionally update test labels/comments where mixed guardrails are unclear.
* Best risk/reward for this task.
* Selected by user.

### Approach C: Test cleanup plus spec compression

* Do Approach B, then trim clearly stale or duplicated prose in long specs.
* Higher payoff if specs are genuinely noisy, but higher risk because specs encode future-agent constraints.

## Decision (ADR-lite)

**Context**: The scan found no maintained spec clones and only modest JavaScript test duplication, but several hotspot tests contain repeated setup and fixtures that make future edits noisy.

**Decision**: Use Approach B. Implement conservative test cleanup in hotspot test files while preserving existing contract assertions and source-text guardrails. Do not include spec compression in the MVP.

**Consequences**: This reduces test maintenance noise with low behavior risk. Longer spec files remain as-is for now, avoiding accidental loss of future-agent constraints.

## MVP Scope

* Reduce repeated authenticated route setup in `test/server-route-guardrails-contract.test.js` where a local helper makes tests clearer.
* Reduce repeated WebUI component file-set declarations in `test/project-maintenance-contract.test.js` where a named fixture represents the same conceptual surface.
* Reduce repeated cookie-source manager/temp-config/cookie fixtures in `test/douyu-passport-contract.test.js` where local helpers preserve explicit assertions.
* Keep all existing test coverage and contract intent.
* Leave `.trellis/spec/**` unchanged during implementation.

## Technical Approach

Implement in small, reversible edits:

1. Read the three hotspot tests around the duplicated regions.
2. Add local helpers/constants only where they remove repeated setup without hiding the assertion being tested.
3. Run `npm run test:contracts`.
4. Run `npm run lint` because `test/**/*.js` is included in the lint script.

## Implementation Summary

* Added `loginAndGetSessionCookie` in `test/server-route-guardrails-contract.test.js` to remove repeated authenticated route setup while keeping route assertions explicit.
* Added `WEBUI_CORE_COMPONENT_FILES` and `readNamedRepoFiles` in `test/project-maintenance-contract.test.js` to name the repeated Vue component surface without hiding source-text guardrails.
* Added focused passport test fixtures in `test/douyu-passport-contract.test.js`: `REFRESHED_MAIN_COOKIE`, `createManualRecoveryDeps`, `recordManualCookieSnapshot`, and `createCookieSourceManagerHarness`.
* Left `.trellis/spec/**` unchanged for the MVP.

## Spec Update Decision

No `.trellis/spec` update is needed for this task. The implementation did not introduce or change API signatures, cross-layer contracts, storage behavior, secrets handling, runtime wiring, or a new testing convention. Existing backend testing guidelines already cover the relevant rule: preserve real source-text guardrails and extract only inspection/setup mechanics when that improves readability.

## Verification

* `npm run test:contracts`
* `npm run lint`
* `npm run type-check`
* `npx --yes jscpd@4.0.5 --min-lines 8 --min-tokens 60 --reporters console --ignore "**/node_modules/**,**/build/**,**/dist/**,**/.trellis/tasks/**,**/.trellis/.backup-*/**,**/package-lock.json" --format javascript,markdown test .trellis/spec`

Final local duplicate scan result:

* Markdown specs: 0 clones, 0 duplicated lines.
* JavaScript tests: 0 clones, 0 duplicated lines.

## Expansion Sweep

### Future evolution

* More Docker WebUI pages and cookie-source flows may add new contract tests; helpers should make repeated setup cheaper without creating a generic test DSL.
* Specs may keep growing scenario-by-scenario; we should preserve a path for concise contract references rather than duplicating implementation history.

### Related scenarios

* Backend testing guidelines already define Guardrail / Behavior / Shape / Mixed categories and warn against deleting real source-text guardrails.
* Previous cleanup already reduced generic helper duplication, so this task should target remaining noisy fixtures and docs rather than repeat that work.

### Failure / edge cases

* Over-abstracting tests can make contract intent less visible.
* Removing spec details can cause future agents to reintroduce known-bad patterns around secrets, CookieCloud, Passport QR, WebUI bridges, or force refresh.
* Clone detectors undercount semantic redundancy and overcount intentional fixture similarity.
