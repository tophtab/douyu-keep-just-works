# Update Login Cookie Status Cards

## Goal

Replace the login page status-card detail cells with direct validity indicators for the three login cookie groups users manage on that page.

## Requirements

* On the login page status card, show these cells: `直播 Cookie`, `鱼吧 Cookie`, and `passport Cookie`.
* Each cell value must be either `有效` or `无效`.
* Remove the current detail cells for `系统就绪`, `粉丝牌`, `来源`, and `passport Cookie` configured state from this card.
* Keep the existing status pills, forms, CookieCloud actions, and passport QR login flow unchanged.
* Derive validity from the existing `/api/cookie-source/check` diagnostics result so the status card and "同步并校验" toast share the same source of truth.

## Acceptance Criteria

* [x] The login status card no longer displays `系统就绪`, `粉丝牌`, or `来源`.
* [x] The card displays `直播 Cookie`, `鱼吧 Cookie`, and `passport Cookie`.
* [x] Each displayed value is exactly `有效` or `无效`.
* [x] Empty or incomplete saved cookie strings display as `无效`.
* [x] Frontend type-check and lint pass for the changed code.

## Definition of Done

* Frontend implementation is scoped to the login status display.
* Existing behavior outside the status-card cells is preserved.
* Quality checks relevant to this frontend change pass.

## Technical Approach

Keep `/api/cookie-source/check` as the single structural cookie diagnostics source. Store its `CookieDiagnostics` response in login-page state, refresh it silently when config loads or changes, and have both `buildLoginStatus()` and the existing "同步并校验" action consume that same state/result.

## Out of Scope

* Backend API changes.
* Live network validation of Douyu login state.
* Changes to CookieCloud sync, manual save, passport QR login, task cards, or overview page behavior.

## Technical Notes

* The login card is rendered by `src/docker/webui/components/LoginConfigPage.vue` through `TaskStatusCard`.
* Existing labels are produced in `src/docker/webui/cookie-source-copy.ts`.
* Existing backend diagnostics define main cookie readiness, Yuba cookie readiness, and passport recovery material. The WebUI should consume the diagnostics response instead of duplicating the key checks.
