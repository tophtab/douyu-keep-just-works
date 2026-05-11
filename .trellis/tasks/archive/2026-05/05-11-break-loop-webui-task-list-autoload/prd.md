# Break Loop WebUI Task List Autoload

## Goal

Fix the Docker WebUI task pages so keepalive, double-card, and yuba status lists automatically load on first entry and do not get stuck in a misleading "preparing to load" state when the backing API fails.

## What I Already Know

- The user still sees keepalive and double-card room lists stuck at `正在准备加载粉丝牌列表，也可以点击刷新手动加载。`.
- The user also reports the yuba page does not trigger its list load until entering/retrying manually.
- The supported WebUI is `src/docker/webui/index.html`, served through `src/docker/webui.ts`; legacy `src/docker/html.ts` is not the live UI.
- Current keepalive/double-card rendering has a guarded fans-list ensure, but `/api/fans` errors are only shown as transient toasts.
- Current yuba rendering shows a "refresh or re-enter" empty state when no data has loaded, but does not ensure a load from the render path.

## Requirements

- Keepalive and double-card pages must call `/api/fans` automatically when a cookie source is configured, no room rows are visible, no fans-list snapshot is loaded, and no fans-list request is pending.
- Yuba page must call `/api/yuba/status` automatically when a cookie source is configured, the mode is supported, no yuba snapshot is loaded, and no yuba request is pending.
- Failed fans-list and yuba-status requests must leave a persistent page-visible error state with an actionable retry hint.
- Manual refresh must clear the persistent error state and retry the relevant request.
- Cookie-source changes, logout/protected-state clears, and successful loads must clear stale list errors.
- Avoid automatic retry loops after a failed load; retry should happen on manual refresh or after the relevant resource is invalidated.

## Acceptance Criteria

- [ ] First entry to keepalive with configured cookies automatically invokes the fans-list load path.
- [ ] First entry to double-card with configured cookies automatically invokes the fans-list load path.
- [ ] First entry to yuba with configured cookies automatically invokes the yuba-status load path.
- [ ] If `/api/fans` fails, keepalive/double-card show the failure inline instead of returning to the generic preparing text.
- [ ] If `/api/yuba/status` fails, yuba shows the failure inline instead of implying no request has been made.
- [ ] Top refresh retries the failed active-page request.
- [ ] `npm run lint`, `npm run type-check`, and `npm run build:docker` pass.

## Out of Scope

- Changing Douyu API parsing or scheduler execution behavior.
- Adding new backend routes or changing response shapes.
- Reintroducing the legacy renderer.

## Technical Notes

- Relevant contract: `.trellis/spec/guides/docker-medal-sync-contract.md`, especially Docker WebUI client request smoothing.
- Relevant frontend index: `.trellis/spec/frontend/index.md`.
- Live WebUI file: `src/docker/webui/index.html`.
