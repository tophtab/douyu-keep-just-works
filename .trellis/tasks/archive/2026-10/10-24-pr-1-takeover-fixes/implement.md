# Implementation Plan — PR #1 takeover fixes

## Preconditions

- Task approved and started (`task.py start`).
- Current `master` is clean; PR head is `f1c157d`.
- No new contributor commits since the takeover comment (re-check `gh pr view 1` before pushing).

## Checklist

### 1. Set up the review branch

- [ ] `git fetch origin pull/1/head`
- [ ] `git worktree add ../douyu-keep-pr1-fix -b pr-1-fix FETCH_HEAD`
- [ ] Symlink `node_modules` into the worktree
- [ ] Record the base SHA (`f1c157d`) for rollback

### 2. Make the quality gate green (R1, R2)

- [ ] Run `npx eslint "src/**/*.{js,ts,vue}" "test/**/*.js" eslint.config.mjs --fix`
- [ ] Manually fix remaining lint errors per design table
- [ ] Update the fake `AppContext` in `test/server-route-guardrails-contract.test.js` to use `passwordStore`
- [ ] Update canonical config key-order assertions in `test/config-guardrails-contract.test.js`
- [ ] Update expected request URLs in `test/code-optimization-contract.test.js`
- [ ] Validation: `npm run lint && npm run type-check && npm run test:contracts`
- [ ] Review gate: all three commands pass before touching behavior

### 3. Fix P1 behavior (R3, R4, R5)

- [ ] Add `updateCurrentConfig` in `src/docker/runtime.ts` and use it for both `setCurrentConfig` deps
- [ ] Add safe snapshot helpers in `src/docker/runtime-task-runners.ts`; never skip `recordTaskRun`
- [ ] Implement explicit-disabled channel semantics and the `disabled` source in `runtime-notify.ts` + types + UI label
- [ ] Validation: `npm run type-check && npm run test:contracts`

### 4. Align report defaults (R6)

- [ ] Set `DEFAULT_PUSH_REPORT_CRON` to `0 0 9 * * *` and `config.example.json` to 09:00
- [ ] Keep the scheduled report on `previousDayKey()`; keep the manual 立即推送 on `currentDayKey()`
- [ ] Add the 待执行 bucket using `getNextCronRuns`; update headline, tags, anomaly list, and fallback text
- [ ] Fix the stale comments so they match the real default (09:00 / previous day)
- [ ] Add `test/push-report-contract.test.js` covering report buckets, 赠送失败 parsing, and log scrubbing

### 5. Low-risk cleanup (R7)

- [ ] Remove `npm_config_registry` from `Dockerfile`
- [ ] Scrub logs in `recordTaskRun`
- [ ] Catch errors in the report scheduler cron callback
- [ ] Fix narrow-screen scrolling for `.push-report-table`

### 6. Full verification

- [ ] `npm run lint`
- [ ] `npm run type-check`
- [ ] `npm run test:contracts`
- [ ] `npm run build:docker`
- [ ] Manual smoke per design section "Verification"
- [ ] `git diff --stat f1c157d` review; confirm no unrelated rewrites and no contributor commit changes

### 7. Publish to PR #1 (requires explicit approval)

- [ ] Post a short PR comment: takeover started, what will change, contributor commits preserved
- [ ] `git push https://github.com/callmenz/douyu-keep-just-works.git pr-1-fix:master`
- [ ] Confirm PR #1 head advanced and `validate` workflow started
- [ ] If GitHub asks for workflow approval, the maintainer approves
- [ ] Wait for `validate` green (docker job may run on PR)

### 8. Merge (requires explicit approval)

- [ ] Re-read the final diff and CI result
- [ ] Merge with **Create a merge commit** (maintainer preference)
- [ ] Verify `master` history contains contributor commits plus takeover commits
- [ ] Archive the Trellis task and record the PR URL

## Validation commands

```bash
npm run lint
npm run type-check
npm run test:contracts
npm run build:docker
```

## Review gates

1. After step 2: quality gate must be green before behavior changes.
2. After step 6: full local verification plus manual smoke before any push.
3. Before step 7: maintainer explicitly approves pushing to the contributor branch.
4. Before step 8: maintainer explicitly approves merging; use a merge commit.

## Rollback points

- **Before push:** reset/delete `pr-1-fix`; the contributor branch is untouched.
- **After push, before merge:** revert individual takeover commits on the branch (do not force-push the contributor's branch unless the maintainer explicitly asks).
- **After merge:** open a follow-up PR rather than rewriting `master` history.

## Out of scope

See `prd.md` non-goals. Follow-up issues: token masking in `GET /api/config`, `trust proxy`, broader auth hardening.
