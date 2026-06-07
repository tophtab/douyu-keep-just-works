# Redundancy Scan Notes

## Scope

Scanned the maintained Docker TypeScript/Vue project:

* Source: `src/core`, `src/docker`, `src/docker/webui`
* Tests: `test/*.test.js`, `test/helpers`
* Specs consulted: `.trellis/spec/guides/index.md`, `.trellis/spec/guides/code-reuse-thinking-guide.md`, `.trellis/spec/backend/index.md`, `.trellis/spec/frontend/index.md`

## Commands

```bash
rg --files -g '!*node_modules*' -g '!dist' -g '!build' -g '!coverage'
find src -type f \( -name '*.ts' -o -name '*.vue' \) -print0 | xargs -0 wc -l | sort -n
find test -type f -name '*.js' -print0 | xargs -0 wc -l | sort -n
npx --yes jscpd@4.0.5 --min-lines 8 --min-tokens 60 --reporters console --ignore "**/node_modules/**,**/build/**,**/dist/**,**/.trellis/**,**/package-lock.json" --format typescript,javascript,vue,css src test
npx --yes ts-prune@0.10.3 -p tsconfig.docker.json
npx --yes ts-prune@0.10.3 -p tsconfig.webui.json
```

## Tool Results

`jscpd` found low overall duplication:

* TypeScript: 83 files, 10,790 lines, 4 clones, 51 duplicated lines (0.47%).
* JavaScript tests: 10 files, 2,982 lines, 10 clones, 152 duplicated lines (5.10%).
* CSS: 5 files, 1,243 lines, 0 clones.
* Total: 98 files, 15,015 lines, 14 clones, 203 duplicated lines (1.35%).

After the cleanup implementation, `jscpd` reported:

* TypeScript: 83 files, 10,777 lines, 3 clones, 32 duplicated lines (0.30%).
* JavaScript tests: 12 files, 3,042 lines, 7 clones, 88 duplicated lines (2.89%).
* CSS: 5 files, 1,243 lines, 0 clones.
* Total: 100 files, 15,062 lines, 10 clones, 120 duplicated lines (0.80%).

Remaining duplicates are mostly source-text guardrails in contract tests, small response parsing helpers, and local resource success/error branches where further abstraction would hide endpoint-specific behavior.

`knip` default output was not reliable for this repo because it did not recognize the Docker/WebUI entry graph and reported nearly all source files as unused. Do not use that output as deletion evidence unless a repo-specific Knip config is added.

`ts-prune` is useful only as a secondary signal here. It reports many exports that are used only within their own module or are consumed through Vue SFC / runtime patterns. Treat findings as "export surface can maybe be narrowed", not "code can be deleted".

## High-Confidence Cleanup Candidates

### 1. Contract test source-inspection helpers

Evidence:

* `test/request-smoothing-contract.test.js` and `test/webui-error-feedback-contract.test.js` duplicate `readRepoFile`, `getBlockBody`, `getFunctionBody`.
* `test/request-smoothing-contract.test.js` also has `readServerSources` and `getAsyncMethodBody`.
* `test/project-maintenance-contract.test.js` and `test/force-refresh-contract.test.js` duplicate `readRepoFile`.
* Existing helper location: `test/helpers/typescript-module-loader.js`.

Recommendation:

* Add `test/helpers/source-inspection.js` with `repoRoot`, `readRepoFile`, `getBlockBody`, `getFunctionBody`, `getAsyncMethodBody`, and optionally `readDockerServerSources`.
* Update the contract tests to import helpers.

Risk:

* Low. This changes test plumbing only.

Verification:

* `npm run test:contracts`

### 2. Repeated WebUI resource request boilerplate

Evidence:

* `src/docker/webui/resource-fans.ts` repeats the `resource.pending`, `requestSeq`, stale response guard, loading/error mutation, unauthorized handling, and toast pattern across `syncFans`, `loadFansList`, and `loadFansStatus`.
* `src/docker/webui/resource-yuba.ts` follows the same tracked request model.
* Existing abstraction: `src/docker/webui/resource-request.ts` already owns `ResourceRequest`, `createResourceRequest`, `resetResourceRequest`, `trackResourceRequest`, and `withForceRefresh`.
* Contract tests currently assert some of this pattern textually in `test/request-smoothing-contract.test.js` and `test/webui-error-feedback-contract.test.js`.

Recommendation:

* Extend `resource-request.ts` with a narrowly typed helper for tracked resource loaders only if the resulting call sites stay readable.
* Keep user-facing state names in `resource-fans.ts` / `resource-yuba.ts`; abstract the sequencing/error boilerplate, not business response mapping.

Risk:

* Medium. Textual contract tests will need updates and stale-response semantics must stay identical.

Verification:

* `npm run test:contracts`
* `npm run type-check:webui`

### 3. Yuba sign result interpretation

Evidence:

* `src/core/yuba-check-in.ts` repeats result parsing and error handling between `signYubaGroup` and `signYubaGroupWithDyToken`.
* Both paths parse `status_code`, `error`, `message`, Gee verification, login failure, already-signed, and signed states.
* The dy-token path has one extra success condition: empty message + object `body.data`.

Recommendation:

* Extract a local helper in `yuba-check-in.ts` such as `resolveYubaSignResult(body, groupId, options)` rather than broadening `yuba-common.ts` first.

Risk:

* Medium. External API quirks are encoded in those branches; tests should cover both normal and dy-token paths before refactoring.

Verification:

* Add/adjust contract coverage if existing tests do not cover both branches.
* `npm run test:contracts`
* `npm run type-check:docker`

### 4. Small response parsing helpers duplicated across core clients

Evidence:

* `src/core/api.ts` defines local `isRecord`, `readResponseNumber`, and `readResponseString`.
* `src/core/douyu-passport.ts` defines local `isRecord`, `readString`, and `readNumber`.
* `src/core/yuba-common.ts` already has `readNumber` / `readString`, but its number fallback behavior differs (`0` default instead of `undefined`).

Recommendation:

* Only extract this if touching both clients anyway. A shared `src/core/response-utils.ts` with explicit `readOptionalNumber`, `readTrimmedString`, and `isRecord` could reduce future drift.
* Do not reuse `yuba-common.ts` for non-Yuba APIs unless naming and fallback semantics are made explicit.

Risk:

* Low to medium. Small code, but changing fallback semantics would be easy by accident.

Verification:

* `npm run test:contracts`
* `npm run type-check:docker`

## Medium/Low Confidence Candidates

### 5. Barrel export surface narrowing

Evidence:

* `ts-prune` flags some re-exports in `src/core/job.ts` and `src/core/yuba.ts`.
* `src/core/job.ts` is used by `src/docker/runtime-task-runners.ts`.
* `src/core/yuba.ts` is used by `src/docker/runtime-app-context.ts` and `src/core/yuba-check-in-job.ts`.

Recommendation:

* Consider narrowing re-exports only after confirming there is no intended public/internal convenience contract.
* This is a cleanup-only task, not behavior cleanup.

Risk:

* Low if verified with `rg`; medium if external consumers import from source paths despite this repo being an app.

### 6. Large maintenance contract tests

Evidence:

* `test/project-maintenance-contract.test.js` is 757 lines and repeatedly declares WebUI file sets.
* Some repeated file lists are testing different architectural guardrails and should not be blindly abstracted away.

Recommendation:

* If editing this file, extract named file-set arrays only where they represent the same concept.
* Preserve test readability; avoid hiding architecture assertions behind overly generic helpers.

Risk:

* Low to medium. Tests are textual guardrails; readability matters more than eliminating every duplicate list.

## Not Recommended As Immediate Cleanup

* Do not delete code based on default `knip` output.
* Do not refactor all repeated one-liners or simple local parsing helpers just to reduce clone count.
* Do not introduce a broad generic resource framework unless multiple resource modules will immediately use it.
* Do not move Yuba helpers into shared modules if the behavior is specific to one endpoint family.

## Suggested Order

1. Test helper extraction (`test/helpers/source-inspection.js`) - low risk, clear duplicate removal.
2. Barrel export narrowing if confirmed by `rg` and tests - low risk.
3. Yuba sign result helper with targeted tests - medium risk.
4. WebUI resource request abstraction - medium risk, highest maintenance payoff if done carefully.
