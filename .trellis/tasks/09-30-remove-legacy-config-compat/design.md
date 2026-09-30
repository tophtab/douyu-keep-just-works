# Design

## Current-format boundaries

`normalizeDockerConfig` remains the constructor that trims strings, fills defaults and emits stable `DockerConfig`. Remove legacy lookups and the unused `ensureCollectGift` options parameter. Simplify allocation selection to `roomAllocations`, fixed amounts to `count`, switches to `enabled`, and participating rooms to `participatingRoomIds`. Remove the legacy cron constant and special rewrite.

`DockerConfigUpdate` describes current-format updates only. Keep the public type name where useful, but remove old credential fields. Partial merges preserve unspecified current fields and allow explicit empty credentials to clear saved values. Remove branches that delete current fields to allow old aliases to win. Do not redesign the patch API.

API validators consume current names directly. Remove active validation/fallback, numeric model resolution, send/number handling, and enabled-map exceptions. Keep current allocation checks, including fixed/weighted mismatches, finite weights, integral counts and at most one remainder room. Remove old credential-specific route checks. `/api/cookie` uses `mainCookie`/`yubaCookie` only. Cookie-source detection follows `loginCookies`/`cookieCloud` only.

## Unknown input and persistence

Do not add a field denylist or schema dependency. Normalization ignores unknown properties and fills missing current fields. Existing validators reject old task shapes when current requirements are absent/malformed; unrelated extra properties need not cause rejection. Legacy credential-only patches must not change saved current credentials. Old double-card maps fail boolean enabled validation.

Disk storage continues to load JSON through normalization and write current snapshots. Use temporary files for persistence tests; do not load/rewrite the developer runtime config.

## Documentation and coverage

Remove the entire README subsection without relocating its text. Update backend persistence/contracts and frontend type-safety specs to remove promises of backend migration. Preserve historical records.

Replace migration-success tests with observable tests proving aliases no longer affect settings. Preserve default/order/reconciliation coverage and convert unrelated Passport/server fixtures to current credentials. Cover partial merges, explicit clearing, saved cron preservation, validation and old allocation rejection using existing module-loader/server helpers.

## Operational impact

This intentionally stops old snapshots/API aliases from retaining old settings. Current configuration and CookieCloud encryption remain supported. The user subsequently authorized the standard 3.11.0 release: package/lockfile metadata via npm version, v3.11.0 tag, master/tag push, and GitHub Release notes from CHANGELOG. Existing Trellis 0.6.17 updates are included as a separate tooling commit.
