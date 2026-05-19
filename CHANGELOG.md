# Changelog

All notable changes to this project are documented here.

This project follows a simple Keep a Changelog-style format and uses semantic
version numbers. Docker release tags use the full version, such as `2.1.0`.

## Unreleased

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
