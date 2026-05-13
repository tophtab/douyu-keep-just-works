# Current Refactor Candidates

## Context

This is a repo-local review for the current source tree after the completed `05-13-code-refactor-optimization` task. Several earlier cleanup ideas are already done, so this task should not repeat them.

## Candidate A: Extract More Allocation Task Page Mechanics

Files:

* `src/docker/webui/keepalive.ts`
* `src/docker/webui/double.ts`
* `src/docker/webui/expiring.ts`
* possibly `src/docker/webui/task-shared.ts`

Current shape:

* The three task pages share refs for overview/config/fans/loading/enabled/cron/model/rows.
* They repeat config fallback, apply-detail flow, task-card construction, note/empty text plumbing, table visibility, toggle handling, and legacy bridge initialization.
* Existing helpers already cover fan row construction, save/disable/trigger requests, fan-list text, and page event subscription.

Recommended MVP:

* Extract a small shared allocation-page helper or config-application helper.
* Keep task-specific payloads, copy, and special validation local.
* Avoid changing Vue component props/events in the same slice.

Pros:

* Directly targets still-visible duplication.
* Lower risk than deleting another bridge layer.
* Existing tests/type-check should catch most regressions.

Cons:

* Over-generalizing could hide real differences between keepalive, double-card, and expiring-gift behavior.

## Candidate B: Simplify Resource/Legacy State Boundaries

Files:

* `src/docker/webui/resources.ts`
* `src/docker/webui/legacy-state.ts`
* `src/docker/webui/legacy-app.ts`
* `test/request-smoothing-contract.test.js`
* `test/project-maintenance-contract.test.js`

Current shape:

* `resources.ts` and `legacy-state.ts` are still among the largest WebUI files.
* They bridge Vue resources and legacy state, including request coalescing and protected-state clearing.
* Tests encode specific migration constraints.

Recommended MVP:

* Extract one pure helper cluster from `resources.ts` or `legacy-state.ts`, or collapse one bridge responsibility only if tests show a clean ownership boundary.

Pros:

* High long-term cleanup value.
* Reduces migration-era code density.

Cons:

* Higher regression risk because auth/resource loading and request smoothing are involved.
* More likely to require contract test changes.

## Candidate C: Backend Metadata/Routing Cleanup

Files:

* `src/docker/task-metadata.ts`
* `src/docker/runtime-task-runners.ts`
* `src/docker/runtime-scheduler.ts`
* `src/docker/server-task-routes.ts`

Current shape:

* The previous task already expanded metadata helpers.
* Remaining switches may be intentional because task behavior differs.

Recommended MVP:

* Only pursue if inspection finds a remaining repeated map/switch that can become metadata-driven without making task-specific behavior less readable.

Pros:

* Can make task inventory easier to audit.
* Potentially low-risk if the target is a simple mapping.

Cons:

* Risk of creating a too-clever descriptor table.
* Smaller cleanup payoff than frontend duplication.

## Recommendation

Choose Candidate A for the next MVP: extract more shared allocation task page mechanics.

Reasoning:

* It is the clearest remaining duplication after the prior refactor.
* It affects active code but can stay behavior-preserving.
* It avoids the highest-risk auth/resource bridge path while still improving maintainability.
