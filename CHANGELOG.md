# Changelog

All notable changes to this project are documented here.

This project follows a simple Keep a Changelog-style format and uses semantic
version numbers. Docker release tags use the full version, such as `2.1.0`.

## Unreleased

## 3.6.0 - 2026-06-19

### Added

- The login page status card now shows direct validity indicators for live,
  Yuba, and passport cookies using the same cookie diagnostics as the sync and
  check action.

### Changed

- Login cookie diagnostics now refresh when login configuration loads or
  changes, so saved cookie strings are reflected without a separate manual
  check.
- Trellis workflow files, bundled agent skills, project specs, and archived
  task metadata were refreshed to reduce future maintenance and context-loading
  cost.

## 3.5.0 - 2026-06-07

### Added

- Passport QR login now captures browser cookie snapshots and can bridge Douyu
  passport cookies into downstream main-site and Yuba task flows.
- Manual force-refresh controls were added so credential, status, and task
  caches can be refreshed on demand from the Docker WebUI.
- Shared task action, settings section, table section, fan display, backpack
  display, and resource request helpers were added to keep Docker WebUI task
  pages consistent.

### Changed

- Docker build automation now uses faster workflow paths while preserving the
  release image publishing surface.
- Docker runtime task execution, gift allocation, resource loading, Yuba
  helpers, and cookie-source handling were split into smaller focused modules.
- Docker WebUI task pages, login configuration, shell styling, project
  description, icon assets, and shared section layout were simplified for
  denser repeated use.
- Contract test coverage was modernized around config guardrails, route
  guardrails, Passport login, force refresh, and Yuba check-in behavior.

### Fixed

- Douyu QR login now bootstraps the required device cookie, normalizes the main
  login exchange URL, and reports scan status more clearly.
- Yuba login recovery now preserves JWT cookies and can recover Yuba cookies
  from Passport material.
- Force refresh now invalidates status caches correctly, including credential
  and Yuba-related state.
- Cron previews no longer leak future scheduling state before authentication or
  show low-value helper prompts.
- Docker WebUI layout issues were fixed across empty overview table sections,
  run-log action order, manual save button styling, scrollbar styling, and
  cookie input resizing.

## 3.2.0 - 2026-06-02

### Changed

- Docker runtime composition was split into focused modules with clearer
  ownership for startup, CookieCloud synchronization, and task execution.
- Task page and config route plumbing were optimized to reduce cross-module
  coupling while preserving the Docker WebUI deployment surface.
- Dependency and backend type-safety guardrails were hardened.
- Runtime service ownership, credential recovery contracts, and manual
  passport cookie behavior are now documented in project maintenance specs.

### Fixed

- CookieCloud checks no longer expose cookie counts in the check summary.
- CookieCloud-backed credential handling now persists passport cookies and
  retries synchronization after credential failures.
- Manual passport cookie recovery now supports recovery material, uses passport
  cookies for manual recovery, and cleans up manual passport cookie handling.
- CookieCloud persistence and local credential checks are separated so local
  recovery state does not incorrectly imply remote sync state.
- `safeAuth` can recover Douyu cookies from browser snapshot material for
  downstream task flows.

## 3.1.0 - 2026-05-19

### Changed

- Project licensing is now restricted to personal learning, technical
  research, and non-commercial technical exchange.
- Local Trellis templates and project maintenance specs were refreshed,
  including repository analysis and spec bootstrap guidance.

### Fixed

- WebUI task save responses now stay synchronized with the saved task state so
  task pages, resource fans, Yuba settings, and shared task actions reflect the
  persisted configuration consistently.
- WebUI brand navigation now links to the project repository.
- Default task configuration is now sourced from the shared task-defaults
  module instead of duplicating defaults in WebUI resource configuration.

## 3.0.0 - 2026-05-15

### Added

- Docker WebUI now builds as a Vue, Vite, and TypeScript application served as
  static Docker assets.
- Vue WebUI pages were added for authentication, navigation, overview,
  collect, Yuba, keepalive, double-card, expiring gifts, login configuration,
  logs, fans, and shared task status views.
- Typed WebUI modules now cover request handling, resource state, task page
  actions, allocation helpers, cron previews, theme mode, toast messages, and
  date/time formatting.
- Contract tests now cover fan/backpack sorting, gift task helpers, Docker
  WebUI build/runtime expectations, request smoothing, and project maintenance
  release gates.

### Changed

- Docker WebUI migrated away from the legacy imperative browser runtime to a
  Vue-only bootstrap path.
- WebUI task pages, resource loading, page actions, navigation, auth shell, and
  styles were split into focused Vue components and TypeScript modules.
- Legacy WebUI bridge globals, render helpers, table renderers, page routers,
  and action assembly scripts were removed.
- Docker runtime task plumbing now uses shared task metadata, shared defaults,
  and smaller task runner modules.
- Gift task helpers, allocation task helpers, and resource request/state logic
  were consolidated for reuse across task types.
- WebUI table layouts now use more consistent column widths and alignment,
  including Yuba status/detail tables.
- WebUI fan-badge related lists now sort by current intimacy progress
  descending, and backpack detail rows sort by quantity descending.
- Local maintenance metadata was updated for Trellis platform templates,
  project specs, ignored generated artifacts, and release documentation.

### Fixed

- Docker builds keep Vite optional native bindings available in the builder
  environment.
- WebUI resource facade and compatibility bridge leftovers were removed so the
  Vue runtime is the maintained WebUI path.
- Unused WebUI logs module and stale source shell files were removed.

## 2.5.0 - 2026-05-13

### Added

- WebUI fan status now loads progressively so large medal lists can refresh
  without blocking the whole page.
- Request smoothing contract tests now cover Douyu API pacing behavior.

### Changed

- Docker runtime now targets Node.js 24 across package metadata, Docker, CI,
  and local maintenance checks.
- Docker runtime, WebUI, and Yuba logic were split into smaller focused modules
  for easier maintenance.
- WebUI refresh behavior now separates status requests from fan sync work and
  avoids unnecessary repeated refreshes.

### Fixed

- WebUI task room lists now autoload immediately and refresh correctly when
  navigating between task tabs.
- WebUI status and fan refresh requests are throttled to reduce request bursts.
- Web password shortcut login works again after authentication redirects.
- Docker CI lockfile metadata is synchronized for reproducible builds.
- Docker WebUI timestamps now use a compact display format.

## 2.4.0 - 2026-05-07

### Added

- Expiring gift task support for releasing limited-time backpack gifts before
  they expire.
- Double-card tasks can now target limited-time backpack gifts, not only glow
  sticks.
- Docker WebUI example configuration now covers expiring gift settings.

### Changed

- Expiring gift allocation now defaults to weighted allocation, with clearer
  room configuration and preview behavior.
- Docker WebUI tables now use tighter, more consistent spacing and improved
  scanability across overview, backpack, keepalive, double-card, and expiring
  gift views.
- README deployment guidance and the WebUI preview poster were refreshed.

### Fixed

- Weighted allocation now treats configured weights as proportions of the
  active room total instead of fixed percentages.
- Backend task failures now preserve upstream error semantics instead of
  looking like ordinary zero-gift states.

## 2.1.0 - 2026-04-30

### Added

- Docker WebUI-focused release line with visible package version metadata.
- Version iteration scripts for local package metadata updates and intentional
  `Vx.y.z` release tags.
- CookieCloud-backed Douyu cookie synchronization and Docker task controls.

### Changed

- The maintained deployment surface is Docker-first.
