# Fix WebUI Keepalive And Double List Refresh

## Goal

Fix the Docker WebUI regression where the keepalive and double-card task pages still do not reliably refresh or trigger their room lists.

## What I Already Know

* The user reports both the double-card task list and keepalive task list still do not refresh or trigger.
* The supported UI is `src/docker/html.ts`.
* Recent commits changed the same refresh state machine:
  * `983cadc fix: restore webui list refresh triggers`
  * `ceb2d1e fix: remove webui frontend refresh ttl`
* Current code has `ensureFansListForActiveTab()` and `shouldLoadFansListForActiveTab()`, but the trigger is guarded by state such as `hasLoadedFansList()`, `getManagedFans().length`, `state.managedLoading`, and `resource.pending`.
* `loadFansList()` calls `/api/fans`, sets `state.managed.fans`, marks `fansList` loaded, and re-renders all pages.
* Top refresh uses `refreshOverviewSurface()` and should route keepalive/double-card pages to `loadFansList()`.

## Assumptions

* The expected behavior is that entering keepalive or double-card with a configured cookie should issue a fans-list request whenever no visible room rows are available.
* Clicking the top refresh button on keepalive or double-card should issue a fresh fans-list request even if an earlier attempt already marked the resource as loaded.
* This task should stay scoped to the Docker WebUI client-side request/refresh logic unless server evidence shows otherwise.

## Requirements

* Keepalive and double-card tabs must reliably request the fans list when their room table has no rows and cookies are configured.
* Top refresh on keepalive and double-card must request the fans list for the active page.
* Request guards must prevent duplicate concurrent requests without permanently blocking future attempts.
* Empty-list rendering must still distinguish "not loaded yet" from "loaded but account has no fan medals".
* Preserve existing overview, expiring-gift, yuba, and logs refresh behavior.

## Acceptance Criteria

* [ ] Entering `/Configurations/DailyJobConfig` with cookies configured triggers `/api/fans` when no room rows are visible.
* [ ] Entering `/Configurations/DoubleCardConfig` with cookies configured triggers `/api/fans` when no room rows are visible.
* [ ] Clicking the top refresh button on keepalive triggers `/api/fans`.
* [ ] Clicking the top refresh button on double-card triggers `/api/fans`.
* [ ] `npm run lint` passes.
* [ ] `npm run type-check` passes.
* [ ] `npm run build:docker` passes.

## Definition Of Done

* Code stays scoped to Docker WebUI refresh/request logic.
* No secrets are logged or exposed.
* Trellis session is recorded after the fix.

## Out Of Scope

* Changing Douyu upstream API parsing.
* Reworking task scheduling or gift sending behavior.
* Reintroducing the separate sync button unless needed to fix this regression.

## Technical Notes

* Relevant file: `src/docker/html.ts`.
* Relevant contract: `.trellis/spec/guides/docker-medal-sync-contract.md`.
* Relevant frontend guidance: `.trellis/spec/frontend/index.md`, which points current UI changes back to Docker runtime guidelines.
