# brainstorm: prioritize project optimizations

## Goal

Assess today's project state and identify any worthwhile optimization opportunities, ordered by priority. If the repo already looks healthy and no change is necessary, explicitly say so.

## What I already know

* The user wants a priority-ranked list of optimization opportunities for today.
* The user is open to the answer being "no meaningful optimization needed" if that is the honest assessment.
* The git working tree was clean at the start of this review.
* Current branch is `master`, tracking `origin/master`.
* `npm run lint`, `npm run type-check`, and `npm test` all pass.
* `npm audit --json` reports zero vulnerabilities.
* The repo is Docker WebUI-first: `src/docker/` and `src/core/` are the maintained runtime surfaces.
* One older Trellis planning task remains active: `.trellis/tasks/05-06-douyuex-feature-research/`.

## Assumptions (temporary)

* This is an assessment and planning task, not an implementation request.
* Recommendations should prefer small, high-leverage improvements over speculative rewrites.

## Open Questions

* None yet. Repo inspection should answer the first pass.

## Requirements (evolving)

* Inspect repository structure, scripts, specs, tests, recent work, and obvious maintenance signals.
* Produce a priority-ranked recommendation list.
* Clearly distinguish necessary work from optional polish.
* Do not recommend broad rewrites unless there is concrete evidence of risk.
* Implement all recommendations except the old DouyuEx research task, per user decision.
* Keep the implementation Docker WebUI-first and avoid reintroducing desktop/frontend framework surfaces.
* Preserve Node 24 as the supported runtime line.

## Acceptance Criteria (evolving)

* [x] Recommendation includes priority levels and rationale.
* [x] Recommendation cites concrete repo evidence.
* [x] Recommendation says when no urgent optimization is needed.

## Findings

### P0 / Today-blocking

None found. Quality commands pass and audit is clean.

### P1 / Worth doing next

* Align Node version references: `package.json` and `package-lock.json` require `node >=24 <25`, while `.github/workflows/docker.yml` and `CONTRIBUTING.md` still use or document Node 18. This is small but high-signal because CI/runtime/docs should agree.
* Expand lightweight contract tests around high-risk Docker WebUI behavior. Current test coverage is only `test/request-smoothing-contract.test.js`, while recent work touched WebUI navigation, timestamp formatting, and split source injection.

### P2 / Useful but not urgent

* Split or modularize large Docker runtime/WebUI files only when touching nearby behavior. File sizes are currently high: `src/docker/webui/app.js` ~2930 lines, `src/docker/runtime.ts` ~1162 lines, `src/docker/server.ts` ~716 lines, and `src/docker/webui/styles.css` ~1084 lines.
* Decide what to do with the lingering DouyuEx research task. It already identifies candidate backlog items such as client sign-in and claim-only level task rewards, but has unresolved scope questions.

### P3 / Later maintenance

* Plan dependency modernization as a deliberate task, not a drive-by update. `npm outdated --json` shows major-version jumps for `express`, `cron`, `cron-parser`, `eslint`, `@antfu/eslint-config`, and `typescript`, while `npm audit` is clean.
* Documentation polish: `CONTRIBUTING.md` still says `npm test` currently only runs Docker TypeScript build, but `package.json` now runs contract tests before `build:docker`.

## Decision (ADR-lite)

**Context**: The repo is healthy, but the user wants the actionable recommendations implemented today.

**Decision**: Implement Node version alignment, add lightweight contract tests, perform conservative large-file extraction, and modernize dependencies. Do not touch or close the old DouyuEx research task.

**Consequences**: Dependency upgrades may require config/API adaptation. Large-file cleanup should stay behavior-preserving and avoid speculative rewrites.

## Implementation Summary

* Aligned CI and contribution docs with the Node 24 engine declared in package metadata.
* Added project maintenance contract tests covering Node version alignment, `npm test` composition, and Docker WebUI source injection.
* Extracted Docker config validation from `src/docker/server.ts` into `src/docker/config-validation.ts`.
* Extracted Docker task metadata from `src/docker/runtime.ts` into `src/docker/task-metadata.ts`.
* Upgraded runtime dependencies to axios 1.16, cron 4.4, cron-parser 5.5, and Express 5.2.
* Upgraded developer tooling to Antfu ESLint config 9, ESLint 10, and TypeScript 6.
* Migrated ESLint from `.eslintrc` / `.eslintignore` to `eslint.config.mjs`.
* Adapted cron-parser usage to `CronExpressionParser.parse()`.
* Adapted the Docker WebUI fallback route to Express 5 by using checked middleware instead of `app.get('*')`.
* Left `.trellis/tasks/05-06-douyuex-feature-research/` untouched by user request.

## Verification

* [x] `npm run lint`
* [x] `npm run type-check`
* [x] `npm test`
* [x] `npm audit --json` reports zero vulnerabilities.
* [x] Express server creation smoke test passed against the built Docker server.
* [x] `npm outdated --json` only reports `@types/node` 25.x as latest; this is intentionally not adopted because this project targets Node 24.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Implementing optimizations during this assessment.
* Large rewrites without a specific user-approved follow-up task.

## Technical Notes

* Started from Trellis session context and project spec indexes.
* Inspected: `package.json`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/docker.yml`, `tsconfig.docker.json`, `test/request-smoothing-contract.test.js`, `src/docker/runtime.ts`, `src/docker/server.ts`, `src/docker/webui/app.js`, and file lists/line counts.
* Verification commands:
  * `npm run lint` passed.
  * `npm run type-check` passed.
  * `npm test` passed.
  * `npm audit --json` passed with zero vulnerabilities.
  * `npm outdated --json` showed outdated packages but no immediate security pressure.
