# Design — PR #1 takeover fixes

## Branch and workspace

- Base: `refs/pull/1/head` (`f1c157d`).
- Local branch: `pr-1-fix`.
- Use a separate git worktree (`/tmp/pr1-fix` or a sibling directory) with `node_modules` symlinked to the main checkout, so the maintainer's `master` checkout is untouched.
- Push target after approval: `https://github.com/callmenz/douyu-keep-just-works.git pr-1-fix:master` (allowed because `maintainerCanModify: true`).
- Trellis task files stay in the main checkout and are not committed to the PR branch.

## R1 — Lint

Run `npx eslint ... --fix` first, then fix the remaining manual errors:

| File | Fix |
| --- | --- |
| `src/docker/auth-password.ts` | Import `Buffer` from `node:buffer` |
| `src/docker/logger.ts` | Use `\w` / `i` flag equivalents in scrub regexes |
| `src/docker/runtime-notify.ts` | Delete dead helpers (`cookieStatusText`, `statusLabel`, `lastLogLine`, `formatClock`); template literal |
| `src/docker/runtime-task-summary.ts` | Rewrite the delivery regexes to avoid useless lazy quantifiers, super-linear backtracking, and unused capture groups |
| `src/docker/webui/components/AppShell.vue` | Drop the unused `const props =` |
| `src/docker/webui/components/AuthShell.vue` | Move `defineEmits` above `onMounted` |
| `src/docker/webui/security.ts` | Auto-fix `if`/`curly`; fix ignore-case regex |

Do not disable rules inline unless a rule is provably wrong for the code.

## R2 — Contract tests

- `test/server-route-guardrails-contract.test.js`: replace `webPassword: 'secret'` with a fake password store:
  ```js
  passwordStore: {
    verify: password => password === 'secret',
    hint: () => '',
    info: () => ({ source: 'env' }),
    change: () => ({ ok: false, error: '当前密码不正确' }),
    setHint: () => ({ ok: true, hint: '' }),
  }
  ```
  The other five failing cases share this root cause.
- `test/config-guardrails-contract.test.js`: add `pushChannel`, `pushReport` to the expected canonical key order after `ui` in both key-order assertions.
- `test/code-optimization-contract.test.js`: expect `/api/logs/days` in the logs-tab request list.
- Keep the assertions as strict as before; only update the expected contract.

## R3 — Reschedule push report without restart

Root cause: `saveTaskConfig({ pushReport })` does not count as a task payload, so it takes the `setCurrentConfig` branch and never reaches `applyConfig`, where `reportScheduler.reconcile` is wired.

Fix: centralize config application in `src/docker/runtime.ts`:

```ts
function updateCurrentConfig(config: DockerConfig): void {
  currentConfig = config
  setPushChannelConfig(config.pushChannel)
  reportScheduler.reconcile(config)
}
```

Use `updateCurrentConfig` in both `setCurrentConfig` dependency callbacks (the config service and the app context). `DockerReportScheduler.reconcile` is already idempotent when the cron is unchanged, so double invocation is harmless.

Why not route preference saves through `applyConfig`: `applyConfig` also reconciles task jobs and can call `stopTaskJobs()` / log missing-cookie messages for a pure preference save. The direct hook is narrower and has no task side effects.

## R4 — Safe intimacy snapshots

Root cause: `deps.resolveCookieForUrl()` throws when no cookie is resolvable (including CookieCloud configured but not synced), and the call sits outside the `try`, so `recordTaskRun` is skipped and the original error can be replaced in the catch branch.

Fix in `src/docker/runtime-task-runners.ts`:

- Add a helper that resolves the cookie and captures the snapshot, returning `null` on any failure:
  ```ts
  async function safeSnapshot(resolve: () => string): Promise<IntimacySnapshot | null> {
    try {
      return await snapshotIntimacy(resolve())
    } catch {
      return null
    }
  }
  ```
- Use it for the before/after snapshots, both inside and outside the task `try`.
- Ensure `recordTaskRun({ ok: false, error, ... })` always runs with the original error. Never let intimacy collection throw inside the catch block.
- Manual trigger still awaits the failure card (after the record exists).

## R5 — Explicit channel disable

Current behavior: `readMagicPushSettings()` skips a config with `enabled === false` and falls through to env vars.

Fix in `src/docker/runtime-notify.ts`:

- If a config section exists and `enabled === false`, return a dedicated "disabled" result instead of falling through to env.
- Extend the source union to `'config' | 'env' | 'none' | 'disabled'` in `MagicPushSettings`, `getPushChannelSettings`, and `PushReportSnapshot.channel.source`.
- `getPushChannelSettings()` for a disabled channel returns `enabled: false`, `source: 'disabled'`, and still exposes `baseUrl`, `mode`, `tokenSet`, and `tokenPreview` so the form can render and be re-enabled.
- `PushSettingsPage.vue` shows `已禁用` for `source === 'disabled'`.

## R6 — Report time semantics

- Set `DEFAULT_PUSH_REPORT_CRON` to `'0 0 9 * * *'` and `config.example.json` to 09:00.
- Keep the scheduled job (`DockerReportScheduler.run`) and the `sendDailyReport` default on `previousDayKey()`: at 09:00 the current day has hardly any runs, so only the previous day is complete.
- Keep the manual "立即推送" on `currentDayKey()`; the two call sites differ on purpose and the comments must say so.
- **Pending vs missing.** When statistics are for the current day (manual push, or a user-configured evening schedule), `doubleCard` (22:20 / 23:20) and `expiringGift` (23:45) may not have run yet. `buildDailyReportCard` must split enabled tasks without a run on `dayKey` into:
  - **待执行**: the task's cron has at least one next run on `dayKey`.
  - **未执行**: no run on `dayKey` and the next cron run is on a later day (or the cron cannot be parsed).
  - Implement with `getNextCronRuns(cron, 5)` from `src/docker/cron.ts`: any returned ISO date whose Shanghai day key equals `dayKey` means a later run that day. For a previous-day report this naturally yields no pending tasks.
- Update the headline, tags, anomaly list, and fallback text to use the four buckets: 成功 / 失败 / 待执行 / 未执行. Pending tasks are not anomalies; list them separately as `⏳ 待执行：A、B（今日尚未到点）`.
- `nothingRan` becomes "no completed and no failed": if every such task is pending, the headline says tasks are scheduled later that day instead of "无执行记录".

## R7 — Low-risk cleanup

- `Dockerfile`: remove the `npm_config_registry` line; it is unrelated to the feature and changes build behavior for everyone.
- `recordTaskRun`: run `scrubSensitive` over `args.logs` before storing and before cards are built (single choke point).
- `runtime-report.ts`: wrap the cron callback body in `try/catch` and log failures (align with `DockerTaskScheduler`, which catches).
- `PushSettingsPage.vue` scoped CSS: at `max-width: 860px`, make the table shell scroll horizontally for `.push-report-table` instead of letting the page overflow.

## Verification

```bash
npm run lint
npm run type-check
npm run test:contracts
npm run build:docker
```

Manual smoke (local WebUI):

1. Save a new `pushReport.cron`; confirm `nextRun` changes without restart.
2. Send the 22:00 report with `doubleCard` scheduled for 22:20; confirm it is labeled 待执行, not 未执行.
2. Set `MAGICPUSH_URL/TOKEN`, disable the channel in the UI; confirm test/send is refused and the UI shows 已禁用.
3. Trigger a gift task with no cookie; confirm the error is returned and the run is recorded as failed.
4. Switch log dates; confirm history is read-only and "清空今天" is disabled for past dates.
5. Narrow the viewport to ~390px; confirm the push page does not scroll horizontally.

## Rollback

- Local branch only until approval. If a fix regresses, reset `pr-1-fix` to `f1c157d` and reapply smaller commits.
- Nothing is pushed until the maintainer approves.
