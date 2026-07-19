# Build fnOS FPK Release Workflow

## Goal

Publish an installable fnOS `.fpk` package for the existing Docker WebUI from
the same GitHub tag that publishes the Docker image. A maintainer should only
need to push a supported `vX.Y.Z` or `VX.Y.Z` tag; the workflow must build the release
Docker image first, package the fnOS Docker application second, and attach the
result to that tag's GitHub Release.

## Confirmed Facts

- The maintained runtime is the Docker WebUI in this repository.
- `Dockerfile` exposes HTTP port `51417`; `docker-compose.yml` uses image
  `tophtab/douyu-keep-just-works` and persists `/app/config`.
- `.github/workflows/docker.yml` validates the project and publishes a
  multi-architecture Docker image for `vX.Y.Z` or `VX.Y.Z` tags as `<version>` and
  `latest`.
- The fnOS Docker application format requires `manifest`, `config/resource`,
  `config/privilege`, `cmd/main`, a Compose file under `app/docker/`, UI
  entry configuration, and package icons.
- A Docker-only fnOS package can declare `platform=all`; the referenced Docker
  image must still support each target architecture.
- The official fnOS Docker example uses `TRIM_SERVICE_PORT`, `TRIM_PKGVAR`, a
  `docker-project` resource, and a container status check in `cmd/main`.

## Requirements

- Add a versioned fnOS Docker package source directory to the repository.
- Package the existing Docker image rather than rebuilding application code or
  embedding architecture-specific binaries in the FPK.
- Stamp the FPK manifest and Compose image tag from the triggering Git tag after
  stripping the leading `v`.
- Build the FPK only after the multi-architecture Docker image manifest for that
  tag has been published.
- Use a pinned official `fnpack` release and verify its SHA256 before building.
- Generate an `.fpk` artifact and a SHA256 checksum, upload both as workflow
  artifacts, and attach the package/checksum to the matching GitHub Release.
- Permit manual workflow dispatch for reproducible package builds, while tag
  based release builds remain the canonical publishing path. Manual builds
  must still name an existing `vX.Y.Z` or `VX.Y.Z` tag and use that tag as the
  version.
- Keep existing Docker validation and release behavior intact.
- Provide a desktop entry for the existing HTTP WebUI on port `51417`.

## Acceptance Criteria

- [x] Pushing a valid `vX.Y.Z` or `VX.Y.Z` tag publishes the Docker image before FPK
      packaging starts.
- [x] The resulting FPK manifest contains the tag version without its prefix, uses
      `platform=all`, and declares service port `51417`.
- [x] The package Compose project references the exact released image tag,
      maps the fnOS service port to container port `51417`, and persists app
      configuration under an fnOS runtime directory.
- [x] `config/resource` declares the Compose project and `cmd/main status`
      returns success only while the named container is running.
- [x] The workflow fails on a missing or invalid `fnpack` download, malformed
      tag/version, package build failure, or missing package output.
- [x] The matching GitHub Release receives the `.fpk` and checksum assets with
      deterministic names; no local upload step is required.
- [x] The fnOS desktop entry opens the WebUI through the existing HTTP service
      on port `51417`; Unix-socket gateway support is not required.
- [x] Existing lint, type-check, contract tests, and Docker build checks pass.

## Scope Boundaries

- No native fnOS binary build, offline Docker image embedding, or separate
  architecture-specific FPK is required.
- No change to the application authentication model or WebUI behavior is part
  of this task; the package preserves the existing `WEB_PASSWORD` environment
  contract.
- No app-store submission or installation on a physical fnOS device can be
  automated by GitHub Actions; those remain release validation steps.
