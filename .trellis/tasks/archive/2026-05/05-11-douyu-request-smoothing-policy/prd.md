# Keep Douyu Request Smoothing Backend-Focused

## Goal

Keep Douyu-backed WebUI reads responsive while preventing accidental high-frequency upstream Douyu access. The chosen policy is to keep browser-side smoothing limited to in-flight request coalescing and stale-response protection, while backend runtime caches remain responsible for reducing real Douyu traffic.

## What I Already Know

* The user approved the direction to avoid non-essential frontend TTL/cooldown gates, full `/api/fans/reconcile` response caching, and global Express rate limiting.
* Current WebUI resources already track `pending`, `fetchedAt`, and `requestSeq` for `fansSync`, `fansList`, `fansStatus`, and `yubaStatus`.
* Current backend runtime already caches fan lists for 60 seconds, full fan status for 5 minutes, yuba status for 10 minutes, and coalesces pending cache fetches.
* Existing spec already documents this exact policy in `.trellis/spec/guides/docker-medal-sync-contract.md`.

## Requirements

* Preserve frontend in-flight request coalescing for Douyu-backed WebUI reads.
* Preserve backend request caches and pending-promise coalescing as the authority for reducing upstream Douyu request frequency.
* Do not add browser-side TTL/cooldown gates that suppress automatic tab/lazy-load reads.
* Do not cache the complete `/api/fans/reconcile` response because reconciliation has local config side effects.
* Do not add mandatory global Express rate limiting for the personal WebUI.
* Add a lightweight executable guard so future edits are checked against the chosen request-smoothing policy.

## Acceptance Criteria

* [ ] A contract check verifies WebUI Douyu-backed resource loaders still use pending request coalescing.
* [ ] A contract check verifies backend cache TTLs and pending-promise coalescing remain present.
* [ ] A contract check rejects obvious browser-side cooldown/rate-limit terms in the WebUI implementation.
* [ ] A contract check rejects obvious global Express rate-limit dependency/use.
* [ ] `npm test` runs the contract check and Docker build.
* [ ] `npm run lint` and `npm run type-check` pass.

## Definition of Done

* Tests added or updated where appropriate.
* Lint, type-check, and build/test are green.
* Existing request smoothing semantics remain unchanged.
* No unrelated Dockerfile or prior task changes are modified.

## Technical Approach

Add a small Node-based contract test under `test/` and wire it into `npm test` before the Docker build. The test should inspect the relevant source files for stable policy anchors instead of trying to mock Douyu or run the WebUI.

This is intentionally narrow: the implementation should not introduce new runtime throttling behavior. The code already has the desired runtime behavior; the task adds a guardrail to keep it that way.

## Decision (ADR-lite)

**Context**: Douyu-backed pages can trigger several local WebUI API reads through refresh, tab navigation, task execution, or lazy loading. Over-aggressive frontend cooldowns can make pages stale or stuck, while complete reconcile caching can corrupt side-effect semantics.

**Decision**: Use backend cache TTLs and pending-promise coalescing to reduce Douyu traffic. Use frontend pending coalescing and request sequencing only for duplicate local reads and late response protection. Add a contract guard rather than new throttling behavior.

**Consequences**: The WebUI keeps fresh visible-page behavior while backend caches absorb repeat requests. The guard is a static contract test, so it catches obvious drift but does not replace integration testing for every runtime path.

## Out of Scope

* New user-configurable rate limits.
* Full `/api/fans/reconcile` response caching.
* Browser-side TTL/cooldown controls for automatic tab/lazy-load reads.
* Public internet hardening beyond the existing login-protected personal WebUI model.

## Technical Notes

* Relevant frontend file: `src/docker/webui/index.html`.
* Relevant backend files: `src/docker/runtime.ts`, `src/docker/server.ts`.
* Existing contract: `.trellis/spec/guides/docker-medal-sync-contract.md`, especially Shared Request Caches and Docker WebUI Client Request Smoothing.
