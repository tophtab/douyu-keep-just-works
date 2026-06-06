# brainstorm: contract test modernization rethink

## Goal

Re-think contract test modernization from first principles for this repo before implementation. The output should be a scoped, agreed direction that improves maintainability without weakening architecture, secret-boundary, Docker-first, or Vue-only runtime contracts.

## What I already know

* The user explicitly asked to use `trellis-brainstorm` first.
* The user explicitly does not want direct implementation in this pass.
* The user explicitly does not want this brainstorm to rely on the current `06-06-contract-test-modernization` task content.
* This rethink is based on fresh repo inspection of `test/`, `src/`, `package.json`, and `.trellis/spec/`.
* Contract tests run through `node --test test/*.test.js`; `npm test` runs contract tests and then the Docker build.
* The test suite is about 2400 lines. The largest files are `test/douyu-passport-contract.test.js` and `test/project-maintenance-contract.test.js`.
* Source-text assertions are heavily concentrated in `test/project-maintenance-contract.test.js`.
* Existing behavior-test infrastructure already exists: TypeScript module loading, direct route-handler tests, and Express `createServer(ctx)` route behavior tests.
* Backend specs prefer route-level Node tests through `createServer(ctx)` for route auth, config masking, and secret-boundary behavior.
* Frontend specs still expect source/file guardrails for Vue-only runtime, deleted legacy bridge files, and core WebUI organization.

## Assumptions

* "Modernization" should not mean "remove regex tests everywhere"; some source-text checks are the contract.
* The useful distinction is guardrail tests vs behavior tests vs brittle shape tests.
* A good first MVP should prove a pattern and reduce noise without a broad test-suite rewrite.
* No runtime behavior should change during test modernization unless a behavior test exposes a real existing bug.

## Open Questions

* None. Requirements are ready for final confirmation.

## Requirements (evolving)

* Brainstorm and converge before coding.
* Preserve Docker-first backend, Vue-only WebUI, secret masking, and auth cookie lifecycle contracts.
* Keep forbidden-pattern guardrails where the forbidden pattern itself is the contract.
* Prefer behavior-level tests for externally observable route/helper behavior.
* Avoid large test-file reshuffles unless they clearly reduce future maintenance cost.
* Use Approach A as the MVP direction: classify current contracts into guardrail / behavior / shape categories before replacing assertions.
* Defer broad suite restructuring and broad behavior-replacement work until after the taxonomy is explicit.
* Implement the taxonomy-first MVP as documentation plus test-code labels/comments.
* Do not replace assertions, remove assertions, or split test files in the MVP unless a label-only change exposes an obvious typo.
* Put the durable taxonomy documentation in a new `.trellis/spec/backend/testing-guidelines.md` file.
* Update `.trellis/spec/backend/index.md` so future sessions discover the new testing guidelines.
* Limit test-code labels/comments in this MVP to `test/project-maintenance-contract.test.js`.
* Label by `test(...)` block, not by every individual assertion group.
* Use a small fixed category vocabulary: `Guardrail`, `Behavior`, `Shape`, and `Mixed`.
* Keep labels short enough to improve scanning without turning tests into documentation prose.

## Acceptance Criteria (evolving)

* [x] The chosen MVP has a clear target area and explicit non-goals.
* [x] The MVP output type is selected: taxonomy documentation plus labels/comments in key test code.
* [x] The taxonomy documentation location is selected: new backend testing guidelines spec.
* [x] The labeled test-file scope is selected: `test/project-maintenance-contract.test.js` only.
* [x] The label granularity is selected: one label per `test(...)` block.
* [x] The PRD explains which test categories stay source-text and which should become behavior-level tests.
* [x] The implementation plan lists the specific files or test surfaces to inspect before editing.
* [x] The quality gate includes at least `npm run test:contracts`, `npm run lint`, and `npm run type-check`.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / contract tests green before handoff.
* Docs/spec update considered if a durable testing convention emerges.
* Rollback is straightforward because runtime behavior should not change.

## Out of Scope

* Direct implementation during this brainstorm pass.
* Using the existing `06-06-contract-test-modernization` PRD as input.
* Removing all source-text guardrails.
* Replacing source-text assertions with behavior tests in this MVP.
* Splitting or reorganizing test files in this MVP.
* Labeling every contract test file in this MVP.
* Moving the taxonomy into `CONTRIBUTING.md` for this MVP.
* Browser/Playwright test infrastructure.
* Dependency upgrades or CI workflow changes.
* Runtime auth, CookieCloud, Passport, scheduler, or WebUI behavior changes.

## Research References

* [`research/local-test-suite-map.md`](research/local-test-suite-map.md) — fresh local map of test-suite patterns and feasible modernization directions.

## Research Notes

### Candidate Test Categories

* Guardrail tests: filesystem/source checks where the forbidden pattern is the contract, such as deleted legacy WebUI files or no direct task-runner Passport recovery.
* Behavior tests: route/module tests for observable behavior, such as config masking, validation-before-save, cache force refresh, and CookieCloud persist/check semantics.
* Shape tests: exact helper/import/function-body checks that may block safe refactors unless justified as an architecture boundary.
* Mixed tests: test blocks that contain both durable guardrails and behavior/shape checks. These should be candidates for later splitting or behavior replacement, but not in this MVP.

### Feasible Approaches

**Approach A: Taxonomy and labeling first** (Recommended as the first step)

* How it works: classify current contracts, add clearer comments/names, and make only minimal assertion changes.
* Pros: low risk; prevents accidental weakening; creates shared vocabulary.
* Cons: limited immediate brittleness reduction.
* Decision: selected by user as the MVP direction.

**Approach B: Behavior replacement slice**

* How it works: pick one high-value slice and replace brittle shape checks with Express/module behavior tests.
* Pros: tangible improvement; reuses existing helpers; focused diff.
* Cons: needs careful scoping so real guardrails stay intact.

**Approach C: Suite restructuring**

* How it works: split the large maintenance test by domain before or while replacing assertions.
* Pros: improves navigation and ownership.
* Cons: larger diff; more churn; easy to mix movement with coverage changes.

## Expansion Sweep

### Future Evolution

* A durable taxonomy could become a testing convention in `.trellis/spec/backend/quality-guidelines.md`.
* A proven behavior-test pattern can support future auth/runtime refactors without increasing source-regex noise.

### Related Scenarios

* Auth cookie lifecycle tests already mix module behavior tests and source guardrails; modernization should stay consistent with that split.
* Frontend runtime boundaries still need architecture guardrails because a small route/module behavior test may not catch reintroduced legacy bridge files.

### Failure / Edge Cases

* Over-modernizing could remove valuable forbidden-pattern checks.
* Under-modernizing could leave exact implementation-shape regexes that block safe refactors.
* Broad file splitting could create churn without improving signal.

## Decision (ADR-lite)

**Context**: The test suite contains useful source-level architecture guardrails and brittle implementation-shape assertions. Modernizing without a taxonomy risks either weakening guardrails or doing noisy mechanical rewrites.

**Decision**: Start with taxonomy-first modernization. Classify tests as guardrail, behavior, or shape before choosing any assertion replacements. The MVP should include durable documentation in a new backend testing guidelines spec plus labels/comments in key test blocks.

**Consequences**: This minimizes immediate risk and creates a shared decision framework. It intentionally does not reduce many brittle assertions yet; it prepares the next implementation slice to replace assertions safely.

## Technical Approach

1. Add `.trellis/spec/backend/testing-guidelines.md` with the contract-test taxonomy:
   * `Guardrail`: source/filesystem checks are appropriate because the forbidden or required structure is the contract.
   * `Behavior`: prefer route-level or module-level tests because externally observable behavior is the contract.
   * `Shape`: exact implementation-shape checks should be temporary or candidates for replacement.
   * `Mixed`: blocks that combine categories should be labeled and considered for future split/replacement.
2. Update `.trellis/spec/backend/index.md` to reference the new testing guidelines and include them in the backend pre-development checklist.
3. Add concise per-`test(...)` labels/comments in `test/project-maintenance-contract.test.js`.
4. Do not remove assertions, replace assertions, split test files, or change runtime code in this MVP.

## Implementation Plan

* Inspect `test/project-maintenance-contract.test.js` one block at a time and classify each block.
* Add the new backend testing spec and index entry.
* Add short labels/comments to each `test(...)` block in `test/project-maintenance-contract.test.js`.
* Run `npm run test:contracts`, `npm run lint`, and `npm run type-check`.
