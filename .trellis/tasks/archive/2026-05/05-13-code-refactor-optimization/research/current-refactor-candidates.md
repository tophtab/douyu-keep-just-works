# Current Refactor Candidates

## Context

This is a local codebase review for the current `src/` tree. A previous archived review suggested multiple simplification directions. The current source already includes several of those improvements:

* Shared default constants in `src/core/task-defaults.ts`.
* Centralized WebUI bridge event names in `src/docker/webui/bridge-contract.ts`.
* Shared WebUI task helpers in `src/docker/webui/task-shared.ts`.
* Shared allocation row/send helpers in `src/docker/webui/allocation-task.ts`.
* Synchronous, non-mutating gift allocation helpers in `src/core/gift.ts`.

The next task should therefore avoid redoing those and focus on remaining active duplication.

## Candidate A: Frontend Allocation Task Page Extraction

Files: `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, `src/docker/webui/expiring.ts`, plus possibly `src/docker/webui/allocation-task.ts` and `src/docker/webui/task-shared.ts`.

Current shape:

* Each page owns similar refs: overview, raw config, managed config, fans, loading flags, enabled flag, cron, model, and fan rows.
* Each page repeats config fallback, apply-config logic, save/disable/trigger plumbing, note text, empty text, and model-change behavior.
* Existing helpers already cover row construction and basic save/disable/trigger, so a next extraction can be incremental rather than a large generic rewrite.

Likely MVP:

* Extract a small shared helper for common fan-list note/empty-state copy or common apply-config mechanics.
* Keep task-specific text and payload details local.
* Avoid changing the Vue component API in the same pass unless tests force it.

Pros:

* Directly targets the current largest duplicate frontend pattern.
* Behavior can be protected by existing WebUI contract tests and type-check.
* Low to medium risk if the extraction stays helper-sized.

Cons:

* The legacy bridge still constrains shape and lifecycle.
* Over-abstracting could make task-specific behavior harder to read.

## Candidate B: Backend Task Metadata Expansion

Files: `src/docker/task-metadata.ts`, `src/docker/runtime-task-runners.ts`, `src/docker/runtime-scheduler.ts`, and possibly route/config files.

Current shape:

* `task-metadata.ts` already centralizes task type, labels, log categories, record creation, and config lookup.
* Scheduler reconciliation is metadata-driven, but trigger routing and scheduled run selection still use explicit switches/functions.

Likely MVP:

* Expand metadata only where it removes one obvious repeated map/switch.
* Keep task-specific runner functions readable.
* Avoid trying to encode every task behavior into one descriptor table.

Pros:

* Makes task inventory easier to audit.
* Good foundation for future task additions.

Cons:

* Some task differences are real: collect has no config payload, yuba uses two cookies, expiring has a send-room guard.
* A too-clever descriptor can become less readable than the switch it replaces.

## Candidate C: Legacy Bridge Deletion Slice

Files: `src/docker/webui/legacy-app.ts`, `legacy-core.ts`, `legacy-state.ts`, `task-actions.ts`, `task-pages.ts`, `pages.ts`, `events.ts`, plus tests.

Current shape:

* WebUI is Vue-owned in many visible areas but still bootstraps a legacy app and bridge globals.
* Contract tests currently assert many bridge modules still exist, so deletion requires careful test updates and likely page-by-page ownership checks.

Likely MVP:

* Pick one bridge with no remaining active responsibility and delete it, or collapse a bridge into typed Vue/composable APIs.
* Update contract tests to assert the new absence/ownership boundary.

Pros:

* Highest long-term simplification value.
* Removes transitional code rather than just rearranging it.

Cons:

* Highest regression risk.
* Requires more careful browser verification and contract-test rewrites.

## Recommendation

Start with Candidate A: frontend allocation task page extraction.

Reasoning:

* It targets live duplication in three large files without requiring a broad architecture change.
* Existing helper modules provide a natural place for the extraction.
* It can be kept behavior-preserving and verified with existing contract tests plus type-check.
* It is a useful stepping stone toward eventual bridge removal because it clarifies the Vue-owned task-page model.

