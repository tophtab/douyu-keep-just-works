# fnOS FPK Release Workflow Implementation Plan

## Implementation

- [x] Add `packaging/fnos/` with the official Docker-package directory shape,
      manifest, Compose project, resource/privilege JSON, status script,
      desktop entry, and icons derived from `icon.png`.
- [x] Add focused contract coverage for package structure, synchronized ports,
      stable project/container names, durable config mapping, tag placeholders,
      and release-workflow ordering.
- [x] Add `.github/workflows/fnos-fpk.yml` as a reusable/manual workflow that
      validates the tag, checks the exact multi-architecture image, stamps a
      temporary package copy, verifies pinned `fnpack`, builds/checksums the
      FPK, uploads an artifact, and creates/uploads matching Release assets.
      Its pull-request and branch paths should run package-only validation
      without publishing an image or Release.
- [x] Update `.github/workflows/docker.yml` so the release-only FPK caller runs
      after the multi-architecture image manifest succeeds and has only the
      required `contents: write` permission.
- [x] Document fnOS Release installation and the inherited initial WebUI
      password in `README.md`; update workflow path filters where required.

## Validation

- [x] Validate JSON package metadata with `jq`.
- [x] Render the package Compose file with test values using
      `docker compose config` when Docker Compose is available.
- [x] Parse/check GitHub workflow YAML and inspect the resulting diff.
- [x] Download and SHA256-check the pinned `fnpack`, stamp a temporary package
      copy with the current package version, and produce a real `.fpk` locally.
- [x] Inspect the FPK output name/checksum and ensure no generated package or
      downloaded tool is left in the worktree.
- [x] Run `npm run lint`.
- [x] Run `npm run type-check`.
- [x] Run `npm run test:contracts`.
- [x] Run `npm run build:docker` and `npm test` for the final quality gate.

## Risk And Review Gates

- The highest-risk file is `.github/workflows/docker.yml`; preserve all current
  validation, branch/PR image builds, release tags, labels, and cache behavior.
- Do not publish a tag, image, package, or Release during local verification.
- Do not package `latest`; every FPK must contain the version derived from the
  exact validated `vX.Y.Z` or `VX.Y.Z` tag.
- Confirm the temporary stamped files contain neither version placeholders nor
  an invalid tag before invoking `fnpack`.
- A physical fnOS install test is a documented residual check, not a reason to
  claim CI validation that did not occur.
