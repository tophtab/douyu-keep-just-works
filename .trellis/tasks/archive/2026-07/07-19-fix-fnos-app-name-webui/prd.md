# Fix fnOS app name and WebUI launch

## Goal

Make the fnOS package present the project as `douyu-keep-just-works` and open its WebUI in a new browser page instead of an embedded blank fnOS desktop iframe.

## Background

- `packaging/fnos/manifest:3` currently sets `display_name=斗鱼保活`.
- `packaging/fnos/app/ui/config:4` currently sets the entry title to `斗鱼保活`.
- `packaging/fnos/app/ui/config:6` currently uses `type=iframe`. The fnOS application-entry contract defines `iframe` as an embedded desktop window and `url` as a browser tab or external Web view.
- The Docker service listens on container port `51417`. The Compose mapping already uses `${TRIM_SERVICE_PORT}:51417`, so the host port is supplied by fnOS rather than being intrinsically fixed to `51417`.
- fnOS exposes the manifest service port through `TRIM_SERVICE_PORT`; this package keeps the host and container service port at `51417`.
- The package uses a Docker image that serves the WebUI on port `51417`; introducing a gateway socket is unnecessary for the requested behavior.

## Requirements

1. Set the fnOS manifest display name to `douyu-keep-just-works`.
2. Set the fnOS desktop entry title to `douyu-keep-just-works`.
3. Change the desktop entry opening mode from `iframe` to `url` so launching the app navigates to the WebUI in a new page.
4. Keep `manifest.service_port`, the desktop entry port, and the Compose host/container service port at `51417`.
5. Preserve the existing entry ID, HTTP protocol, root URL, icon, and all-user visibility.
6. Extend the fnOS packaging contract test to lock the corrected title and opening mode.
7. Rebuild and publish a corrected tagged fnOS FPK through the existing GitHub Actions release workflow.

## Acceptance Criteria

- [ ] `packaging/fnos/manifest` exposes `display_name=douyu-keep-just-works`.
- [ ] `packaging/fnos/app/ui/config` exposes title `douyu-keep-just-works` and type `url` for `douyu-keep-just-works.main`.
- [ ] The entry uses HTTP port `51417` and URL `/`.
- [ ] `npm test` and the fnOS packaging contract test pass.
- [ ] The release workflow builds the corrected FPK and attaches its package and SHA256 assets to the selected GitHub Release tag.
- [ ] The final Git worktree is clean and the selected tag points at the published correction.

## Scope

In scope: fnOS package metadata, desktop entry configuration, contract tests, and the tag-triggered FPK release.

Out of scope: changing the Docker WebUI itself, changing the container listener from `51417`, introducing the fnOS unified gateway/socket, or changing authentication defaults.

## Release Decision

- Overwrite the existing `v3.9.0` tag and replace its fnOS FPK assets after the corrected package is built.
