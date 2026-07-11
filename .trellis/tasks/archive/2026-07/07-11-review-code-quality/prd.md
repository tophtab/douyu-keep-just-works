# Review code optimization opportunities

## Goal

Review the current application code for concrete optimization opportunities in structure, readability, reuse, type modeling, testability, and runtime efficiency; produce prioritized, evidence-based recommendations. After user review, implement only the explicitly accepted low-risk items.

## Background

- The maintained application is a TypeScript single repository with shared Douyu logic in `src/core/`, an Express-based Docker runtime in `src/docker/`, and a Vue WebUI in `src/docker/webui/`.
- The working tree contains pre-existing uncommitted Trellis/platform integration updates under `.trellis/`, `.agents/`, and `.cursor/`. Those changes are not application findings unless they directly affect application build or runtime behavior.
- Baseline verification on 2026-07-11: lint, backend/frontend type checks, and all 33 contract tests pass.
- Baseline dependency auditing found one high-severity advisory in the production dependency tree (`form-data`); this is supporting context rather than the main review focus.

## Requirements

- Identify modules with excessive responsibilities, high cognitive complexity, duplicated workflows, or unclear ownership boundaries.
- Review whether shared types, constants, helpers, and state abstractions are reused consistently across backend and WebUI code.
- Identify opportunities to simplify control flow, error propagation, async orchestration, and state transitions while preserving behavior.
- Identify runtime efficiency opportunities only when a plausible hot path, redundant request, repeated parsing, unnecessary allocation, unbounded growth, or avoidable I/O is visible.
- Assess whether current tests make future refactoring safe and identify high-value testability improvements.
- Prioritize recommendations by expected maintenance or runtime benefit versus implementation cost and regression risk.
- Each recommendation must include file:line evidence, the current cost, and a practical optimization direction.
- Keep correctness and security findings secondary unless inspection reveals a concrete issue that should not be omitted.
- Preserve the intentional serial request behavior for Douyu double-card checks because request frequency may affect platform risk controls.
- Do not add new automated tests in this task.
- Change gift sending so the existing two-second rate-limit delay remains between attempted sends but is not paid after the final attempt.
- Update the production dependency lock to resolve the reported high-severity `form-data` advisory, without unrelated major-version upgrades.
- Rename `src/core/medal-sync.ts` to an accurate configuration-normalization module name and update all imports/spec references.
- Remove only explicit legacy-shape conversions for `SendGift.percentage`, `manualPassport.ltp0`, and double-card selection inferred from `send`; preserve current config defaults, the top-level `cookie` contract, and fan reconciliation.
- Refactor credential snapshot recovery into named stage functions within the existing file while preserving behavior, logs, retry count, validation, and persistence rules.

## Acceptance Criteria

- [x] Run and report lint, type-check, contract-test, build, and production dependency audit results.
- [x] Inspect representative complex or central backend and frontend modules, plus configuration, scheduling, caching, persistence, and shared state paths.
- [x] Report optimization opportunities in priority order with file:line evidence, expected benefit, effort/risk, and concrete remediation guidance.
- [x] Distinguish worthwhile optimizations from cosmetic refactors that are unlikely to repay their cost.
- [x] Call out test gaps that materially make optimization or refactoring harder.
- [x] Gift sending preserves serial requests and two-second spacing between attempts, while eliminating the final unnecessary delay.
- [x] `npm audit --omit=dev --audit-level=moderate` exits successfully with no reported vulnerability.
- [x] Existing lint, type-check, contract tests, and Docker build pass after the accepted changes.
- [x] Config normalization uses the current config shape without the three retired legacy conversions.
- [x] Configuration imports and project specs reference the accurately named module.
- [x] Credential recovery orchestration is split into same-file stages with existing contract behavior preserved.
- [x] Preserve and do not revert unrelated pre-existing working-tree changes.

## Out of Scope

- Adding new tests, parallelizing Douyu requests, introducing WebUI response decoders, removing the current top-level `cookie` field, or splitting credential recovery across multiple files.
- Reviewing generated Trellis/platform integration updates unless they affect the application build or runtime.
- Live testing against real Douyu accounts or external services.

## Technical Notes

- This is a lightweight, read-only audit task, so a PRD-only plan is sufficient.
- Recommendations should favor the repository's existing architecture and documented Trellis specs over broad rewrites.
