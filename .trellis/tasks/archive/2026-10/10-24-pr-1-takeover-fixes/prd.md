# Take over PR #1: fix CI and P1 issues

## Context

- External contributor PR #1 (`callmenz:master`, head `f1c157d`) adds MagicPush integration, WebUI password change, mobile layout, log persistence, and task run history.
- The PR has had no new commits or replies after the maintainer's 2026-10-22 review comment and weekend deadline.
- `validate` CI fails at lint; a local run of the same commands also shows 8 contract test failures. `master` is green (lint 0 errors, 49/49 contract tests).
- Per the PR comment, the maintainer takes over: commits are appended on top of the contributor branch, contributor commits and authorship are preserved, PR #1 stays the review unit, and the merge uses a merge commit.

## Goal

Bring PR #1 to the repository's existing quality gate and fix the blocking functional defects without rewriting contributor history.

## Requirements

- **R1 — CI lint green.** Fix all eslint errors introduced by PR files (30 errors; 21 auto-fixable).
- **R2 — Contract tests green.** Adapt tests to the `AppContext.passwordStore` change, the new `pushChannel` / `pushReport` config sections, and the new `/api/logs/days` bootstrap call. Do not weaken the guardrails.
- **R3 — Push schedule persists immediately.** Saving `pushReport` (enabled / cron) from the WebUI must start, stop, or reschedule `DockerReportScheduler` immediately, without a restart or an unrelated task save.
- **R4 — Intimacy snapshots never block task execution or recording.** An unresolvable cookie must still produce a failed `TaskRunRecord` carrying the original error; a manual trigger must still push the failure card.
- **R5 — Explicit channel disable works.** `pushChannel.enabled = false` must stop pushes even when `MAGICPUSH_URL` / `MAGICPUSH_TOKEN` are set. The UI must show a distinct disabled state without losing the editable values.
- **R6 — Daily report time and statistics agree.** Set the default cron to 09:00 (`0 0 9 * * *`, `config.example.json` too) and keep the scheduled report on the **previous day**, which is the only complete day at 09:00. The manual "立即推送" keeps the **current day** and must label tasks whose cron still has a run later today as 「待执行」, not 「未执行」. Update the stale comments so they state the real default.
- **R7 — Low-risk correctness cleanup.**
  - Remove the unrelated `npm_config_registry` override from `Dockerfile`.
  - Scrub secrets before persisting run history and before putting logs in push cards.
  - Make the report scheduler cron callback error-safe.
  - Let the new push report table scroll horizontally on narrow screens.
- **R8 — Attribution.** Append commits; do not rewrite contributor commits. Merge with a merge commit.

## Non-goals

- Masking `pushChannel.token` in `GET /api/config` (existing config API pattern; follow-up issue).
- `trust proxy` / per-IP login throttle redesign.
- Refactoring the MagicPush channel abstraction or card templates.
- Splitting this already-large PR into multiple PRs.

## Acceptance Criteria

- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm run test:contracts` passes.
- [ ] `npm run build:docker` passes.
- [ ] PR #1 `validate` check is green.
- [ ] Manual smoke: saving a new push time changes `nextRun` without restart; disabling the channel with env vars set refuses test/send; a gift task with no cookie surfaces the error and records a failed run; the default push time creates a 09:00 schedule whose report covers 前一日, while a manual 立即推送 mid-day labels a still-pending task 待执行 rather than 未执行; the logs date picker works; the push report table does not overflow the page at ≤860px.
- [ ] Contributor commits are untouched and the final merge uses a merge commit.
- [ ] Nothing is pushed to the contributor branch until the maintainer explicitly approves.

## Constraints

- Work on a branch based on `refs/pull/1/head`; never commit directly to `master`.
- Do not push, merge, or post a PR comment without explicit maintainer approval.
- Keep Trellis task artifacts out of commits pushed to the contributor branch.
