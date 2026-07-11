# Design

## Scope And Boundaries

The implementation is one focused optimization batch with four independently verifiable changes. They remain in one task because the code changes are small, share the same quality gate, and do not require separate rollout or ownership. No security work, architecture rewrite, new state library, schema framework, or increased Douyu request concurrency is included.

## CI Contract-Test Gate

- Update `.github/workflows/docker.yml` path filters so changes under `test/**` and to `eslint.config.mjs` trigger validation.
- Add `npm run test:contracts` to the existing `validate` job after type checking and before the Docker runtime build.
- Do not call `npm test` from CI because it would invoke `build:docker` and duplicate the existing build step.
- Preserve the current Docker build/publish jobs, tags, platforms, cache scopes, provenance, and SBOM behavior.

## Task-Local Room DID Reuse

- Add a small room-DID resolver in the gift-task boundary. It owns a `Map<number, string>` for one task execution.
- Cache only successful `getDid` results. A failed lookup is not stored, so a later gift group may retry the same room and current recovery behavior is preserved.
- Allow `sendGifts` to receive the resolver while retaining a default path for existing single-group callers.
- `executeExpiringGiftJob` and limited-time `executeDoubleCardJob` create one resolver before iterating gift groups and pass it to every `sendGifts` call.
- Keep actual gift sends serial. Preserve failed-count carry-over, two-second spacing between attempted sends, current logs, and the absence of a final delay.
- Do not persist DID values across scheduled runs or place them in the Docker runtime cache.

## Lazy Full-Log Loading

- Remove `loadLogs()` from the unconditional authenticated bootstrap batch in `loadProtectedData`.
- Keep `loadConfig()` and `loadOverview()` in the bootstrap batch.
- Reuse `loadActiveTabData('logs')` for the first full-log request when the logs tab is active.
- Preserve the overview endpoint's recent-log summary, manual refresh, clear action, active-tab five-second auto refresh, and protected-state clearing.
- Do not change the backend log retention limit or API shape.

## WebUI Config Mutation Helper

- Add a small helper beside `resource-config.ts` that posts a partial config payload to `/api/config`, reads the existing `{ ok, data }` response envelope, and applies `data.config` to shared `rawConfig` when present.
- Move the common config mutation result types (`config`, optional reconciled `fans`) to this shared owner.
- Migrate task config saves, manual-cookie saves, CookieCloud saves, and theme saves to this helper.
- Return the response data so task pages can continue applying reconciled fans and feature modules can run their existing follow-up behavior.
- Keep feature-owned behavior local: optimistic checkbox rollback, theme rollback, toasts, CookieCloud diagnostics, cookie-backed resource invalidation, form-state application, and overview refresh.
- Do not make the helper a generic endpoint client or resource lifecycle framework.

## Test Design

- Extend or add lightweight Node contract tests using the existing TypeScript module loader and dependency mocks.
- Gift tests cover:
  - one successful DID lookup per room across multiple gift groups;
  - serial send ordering;
  - failed gift count carry-over;
  - delay only between attempts.
- WebUI resource tests cover:
  - authenticated bootstrap does not request `/api/logs` for a non-log active tab;
  - the logs active-tab path requests `/api/logs` once.
- Config helper tests cover:
  - the payload sent to `/api/config`;
  - shared raw config is replaced with the full config returned by the backend;
  - optional reconciled fans remain available to task-page callers.
- Avoid component snapshots and browser automation because the changed contracts are request orchestration rather than visual behavior.

## Compatibility And Rollback

- No persisted config format, route path, API response shape, task schedule, or user-visible setting changes.
- Runtime request count only decreases within multi-gift tasks; external send ordering remains unchanged.
- Each change can be reverted independently: workflow gate, DID resolver wiring, bootstrap log call, or config helper call-site migrations.
- If helper migration exposes a feature-specific response difference, keep that feature on its current direct request temporarily rather than widening the helper abstraction.

