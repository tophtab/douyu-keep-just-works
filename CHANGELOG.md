# Changelog

All notable changes to this project are documented here.

This project follows a simple Keep a Changelog-style format and uses semantic
version numbers. Docker release tags use the full version, such as `2.1.0`.

## Unreleased

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
