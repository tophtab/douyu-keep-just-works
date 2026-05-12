# brainstorm: project improvement opportunities

## Goal

Assess the current project and identify practical improvement opportunities across product scope, developer experience, reliability, maintainability, and delivery workflow, so we can choose one or more focused follow-up tasks instead of making broad unfocused changes.

## What I already know

* The user asked in Chinese: "看一看我这个项目还有哪些改进空间？"
* This is currently an assessment / brainstorming task, not an implementation task.
* The repo is Trellis-managed and currently on `master` with a clean working tree.
* There is one existing active planning task: `05-06-douyuex-feature-research/`.
* The project is Docker WebUI-first, with TypeScript core logic under `src/core/`, Docker runtime under `src/docker/`, and static WebUI source under `src/docker/webui/`.
* Recent archived work already handled Node 24 alignment, dependency modernization, Express 5 compatibility, Docker build/CI fixes, WebUI source splitting, and initial maintenance contract tests.
* Current verification passed: `npm run lint`, `npm run type-check`, `npm test`, and `npm audit --json`.
* `npm outdated --json` currently reports only `@types/node` patch drift within the Node 24 line; Node 25 types are intentionally not adopted while the runtime targets Node 24.
* Local `config/config.json` contains real runtime credentials but is ignored by Git via `config/`.

## Assumptions (temporary)

* The desired output is a prioritized improvement map with concrete next-step options.
* Improvements may cover code quality, UX, automation, docs, release/CI, and operational reliability.
* We should inspect the repo before asking the user to choose a direction.

## Open Questions

* Which improvement lane should we prioritize first: security/defaults, tests, feature backlog, WebUI maintainability, or operational polish?

## Requirements (evolving)

* Inspect project structure, scripts, specs, and recent Trellis task history.
* Identify high-signal improvement opportunities with expected value and effort.
* Do not add the broad runtime executable-test suite as part of this task.
* Continue behavior-preserving file splitting at natural boundaries.
* Ground recommendations in current repo evidence and avoid repeating already-completed 05-11 optimization work.
* Keep the Docker WebUI static-file deployment contract intact while splitting source files.
* Preserve existing public imports from `src/core/yuba.ts`.

## Acceptance Criteria (evolving)

* [x] Produce a short, prioritized list of improvement opportunities grounded in repo evidence.
* [x] Separate quick wins from larger investments.
* [x] Ask one preference question to converge on the next actionable task.
* [x] Split WebUI script constants/data from the main application script without adding static asset routes.
* [x] Split shared Yuba HTTP/parsing helpers from the Yuba feature workflow while preserving existing exports.
* [x] Existing contract tests still pass and Docker runtime still builds.

## Findings

### P0 / Urgent

None found. Lint, type-check, contract tests plus Docker build, and npm audit all pass.

### P1 / High-value next work

* Harden security defaults around WebUI access: `src/docker/index.ts` falls back to `WEB_PASSWORD=password`, and README / compose examples use the same placeholder. This is convenient but risky if a NAS/container is exposed beyond localhost.
* Add behavior-level tests for server/runtime logic. Current tests are useful contract tests, but mostly inspect source text. High-risk areas such as Express auth/session routes, config validation, cookie masking, config save/reconcile, and pure gift-selection logic would benefit from executable tests.
* Convert the still-active DouyuEx research task into a real backlog decision. Its best candidates are client sign-in and claim-only level-task rewards; several other DouyuEx ideas have already been rejected by user preference.

### P2 / Useful, not urgent

* Continue modularizing only at natural boundaries. `src/docker/webui/app.js` is about 2930 lines, `src/docker/runtime.ts` about 1128 lines, `src/core/yuba.ts` about 612 lines, and `src/docker/webui/styles.css` about 1084 lines. Recent splitting helped, but further extraction should follow real feature work.
* Add a lightweight secret-safety gate. `config/` is ignored, but a pre-commit-style or CI check for accidental cookies/passwords in tracked files would reduce the most painful failure mode for this kind of project.
* Improve operational diagnostics: backup/export sanitized config, visible "why not ready" status, or a one-click diagnostics bundle that redacts secrets.

### P3 / Later

* Patch `@types/node` within the Node 24 line when convenient.
* Consider Playwright smoke tests for the Docker WebUI once UI churn slows down.

## Possible Next Approaches

**Approach A: Security/defaults hardening** (Recommended)

* Require a non-default WebUI password or show a loud startup/WebUI warning when the default is used.
* Update README / compose examples to avoid copy-pasting `password`.
* Optionally add a secret-leak contract test for tracked examples/docs.

**Approach B: Runtime test foundation**

* Add actual Node tests around Express routes, config validation, cookie masking, and selected pure core helpers.
* Keep existing source-contract tests where they protect maintenance contracts.

**Approach C: Product backlog convergence**

* Finish the DouyuEx task by choosing whether to implement client sign-in, claim-only level rewards, both, or neither.
* Turn the chosen candidate into a PRD with risk boundaries before coding.

**Approach D: WebUI maintainability**

* Extract repeated WebUI render helpers / task page patterns from `app.js`.
* Keep behavior unchanged and add smoke tests only around extracted behavior.

## Sequencing Recommendation

Prefer a small test seed before large-file refactors, but avoid turning this small Docker utility into a heavy test project.

* `app.js` and `runtime.ts` are large, but they currently encode working behavior across auth, config persistence, task scheduling, cookie source resolution, status caches, and WebUI state transitions.
* Refactoring those files before behavior tests would make review rely mostly on manual comparison and source-contract tests.
* A broad executable-test foundation for Express auth/session, config validation, cookie masking, and gift-selection behavior is probably too much upfront.
* A better next step is one small, high-value executable test only when it protects an imminent refactor or bug fix.
* After a narrow test exists for the specific boundary being changed, split that boundary and keep the extraction behavior-preserving.

## Test Scope Decision

The user raised a valid concern that adding many runtime tests may make the project too heavy. Decision: do not add a broad runtime test suite as a standalone maintenance task. Prefer lightweight contract tests plus targeted executable tests only when they directly reduce risk for a planned refactor or a known bug.

## Implementation Decision

The user confirmed on 2026-05-12 that we should skip the proposed broad test-foundation work for now, but still do the file-splitting part of the improvement task.

* WebUI source splitting should keep `index.html` as the shell and keep `src/docker/webui.ts` responsible for injecting source files into the served HTML.
* The initial split should be low-risk: extract WebUI metadata/default config and route/path helpers into separate ordered scripts, then make the injector concatenate scripts in a fixed order.
* Yuba code should keep `src/core/yuba.ts` as the public import surface, while moving shared HTTP/header/body/parsing helpers into a separate source file.
* Existing contract tests may be updated to reflect split-file injection, but do not add the broad runtime behavior test suite in this task.

## Expansion Sweep

* Future evolution: the app could grow from "single-account Docker helper" into a more observable personal automation console, but multi-account/profile support has already been rejected for now.
* Related scenarios: security defaults, diagnostics, and test coverage should remain consistent across manual cookies, CookieCloud, scheduled jobs, and manual triggers.
* Failure / edge cases: accidental secret leaks, exposed default password, upstream Douyu API shape changes, and brittle source-contract tests are the main risks worth designing around.

## Verification

* [x] `npm run lint`
* [x] `npm run type-check`
* [x] `npm test`
* [x] `npm audit --json`
* [x] `npm outdated --json`

## Definition of Done (team quality bar)

* Tests added/updated if a later implementation task changes behavior.
* Lint / typecheck / CI green for any later implementation work.
* Docs/notes updated if behavior or workflow changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Adding the broad runtime executable-test foundation proposed during assessment.
* Reworking `src/docker/runtime.ts` or `src/docker/webui/app.js` into many feature modules in one large refactor.
* Changing user-visible behavior or Docker deployment shape.

## Technical Notes

* Task created at `.trellis/tasks/05-12-project-improvements/`.
* Initial context loaded from `.trellis/workflow.md`, `.trellis/spec/guides/index.md`, and `get_context.py`.
* Trellis quality guidance requires running lint, type-check, and tests through `trellis-check`.
* `.agents/skills/trellis-check/SKILL.md` asks whether a new function has a unit test, a bug fix has a regression test, and changed behavior has updated tests.
* `.trellis/spec/backend/quality-guidelines.md` says the current repo has no full automated backend suite yet; current safety nets are TypeScript build, lint, `npm test`, and manual Docker WebUI verification.
* Existing Trellis guide docs include executable-contract areas for Docker WebUI auth and Docker medal/task sync, which map naturally to the proposed Express/session, config validation, cookie masking, and gift-selection tests.
