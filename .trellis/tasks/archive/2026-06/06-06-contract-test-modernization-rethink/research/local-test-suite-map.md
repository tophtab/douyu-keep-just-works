# Local Test Suite Map

## Question

What does "contract test modernization" plausibly mean in this repo if we ignore the previous implementation task and reason from the current test suite?

## Current Evidence

* `package.json` runs `node --test test/*.test.js` for contract tests and `npm test` runs contract tests plus the Docker build.
* Test file sizes:
  * `test/douyu-passport-contract.test.js`: 896 lines.
  * `test/project-maintenance-contract.test.js`: 552 lines.
  * `test/force-refresh-contract.test.js`: 204 lines.
  * `test/server-route-guardrails-contract.test.js`: 228 lines.
  * Remaining contract files are smaller and mostly focused.
* Source-text assertions are concentrated in `test/project-maintenance-contract.test.js`, which has about 294 `assert.match` / `assert.doesNotMatch` checks.
* Existing non-regex behavior patterns already exist:
  * `test/helpers/typescript-module-loader.js` loads TypeScript modules through transpilation for direct unit-style behavior tests.
  * `test/server-route-guardrails-contract.test.js` runs `createServer(ctx)` with a fake `AppContext` for Express behavior.
  * `test/force-refresh-contract.test.js` tests both route handlers and `DockerRuntimeCache` behavior.
  * `test/config-guardrails-contract.test.js` directly tests config normalization/reconciliation behavior.
* Backend quality guidance says route auth, config masking, and secret-boundary behavior should prefer route-level Node tests through `createServer(ctx)` over source-text regex checks.
* Frontend quality guidance still expects `test/project-maintenance-contract.test.js` to protect core WebUI component organization, Vue-only runtime boundaries, and legacy bridge deletion.

## Taxonomy

### Guardrail Tests

Purpose: prevent architectural regressions that are hard to observe through a small behavior test.

Examples:

* Legacy WebUI bridge files must stay deleted.
* `main.ts` must not mount old imperative runtimes.
* Task runners must not directly call Passport `safeAuth` / `LTP0` refresh helpers.
* Build scripts must keep the Vite Docker WebUI path.

These can remain source-text or filesystem checks because the forbidden condition is the contract.

### Behavior Tests

Purpose: verify externally observable contracts or public helper behavior.

Examples:

* `/api/config` masks public secrets while `/api/config/raw` stays raw.
* `/api/config` validates before saving.
* CookieCloud sync/check calls the correct backend methods with the right `forceRefresh` semantics.
* Config normalization fills defaults and migrates legacy fields.

These are better as fake-context Express tests or direct TypeScript module tests.

### Shape Tests

Purpose: preserve exact implementation structure, import locations, or helper names.

Examples:

* A route imports a specific helper.
* A component imports a specific sibling module.
* A function body contains a particular line sequence.

These are the brittle middle category. Some are useful while a boundary is young, but many should either become behavior tests or be rewritten as a narrower forbidden-pattern assertion.

## Feasible Approaches

### Approach A: Taxonomy And Labeling First

Classify existing tests into guardrail / behavior / shape categories, rename or comment test blocks accordingly, and only make small assertion changes.

Pros:

* Lowest risk.
* Builds shared vocabulary before changing coverage.
* Helps future refactors know which checks are intentionally source-text.

Cons:

* Does not immediately reduce much brittleness.
* May feel like documentation churn unless paired with a few concrete improvements.

### Approach B: Behavior Replacement Slice

Pick one slice where behavior tests already have infrastructure, then replace brittle source-text assertions in that slice with route/module behavior tests.

Candidate slices:

* Config routes and secret masking.
* CookieCloud sync/check route semantics.
* Force refresh and cache read semantics.

Pros:

* Directly reduces brittle assertions.
* Uses existing test helper patterns.
* Keeps blast radius narrow.

Cons:

* Requires careful selection so architecture guardrails are not weakened.
* May leave the big maintenance test structurally large.

### Approach C: Test Suite Restructure

Split `project-maintenance-contract.test.js` by domain, for example build/runtime, WebUI architecture, auth/cookie guardrails, and route behavior.

Pros:

* Improves navigation and ownership.
* Makes later modernization easier.

Cons:

* Larger diff with limited immediate behavior value.
* Can obscure whether coverage changed.
* Higher chance of merge churn.

## Recommendation

Start with Approach A plus a small Approach B slice. Define the taxonomy first, then modernize one behavior-heavy area where the repo already has test infrastructure. Defer broad file splitting until after the categories are explicit and at least one replacement pattern is proven.
