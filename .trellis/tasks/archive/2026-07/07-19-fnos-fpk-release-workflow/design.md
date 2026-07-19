# fnOS FPK Release Workflow Design

## Architecture

The repository will own an fnOS Docker package template under
`packaging/fnos/`. It contains only package metadata, Compose configuration,
lifecycle status handling, and image assets. Application code remains in the
Docker image and is not duplicated into the FPK.

A dedicated reusable workflow, `.github/workflows/fnos-fpk.yml`, will support:

1. `workflow_call` from the existing Docker release workflow.
2. `workflow_dispatch` with an explicit existing `vX.Y.Z` or `VX.Y.Z` tag for
   controlled rebuilds.

The existing `.github/workflows/docker.yml` will add one release-only job that
depends on `release-manifest` and calls the FPK workflow with the triggering
tag. This creates a strict release sequence:

```text
[vV]X.Y.Z tag
  -> validate repository
  -> publish amd64 + arm64 Docker digests
  -> publish version/latest multi-arch manifests
  -> build fnOS FPK from the same tag
  -> create or update the tag's GitHub Release assets
```

## Package Contracts

`manifest` declares a third-party `platform=all` Docker application, service
port `51417`, stoppable lifecycle controls, a desktop UI directory, and a
stable desktop entry ID. Its checked-in version is a build placeholder; the
workflow stamps the tag version in a temporary directory.

`app/docker/docker-compose.yaml` references
`tophtab/douyu-keep-just-works:<version>`. The checked-in image tag is an
unambiguous placeholder that must be replaced and checked before packaging.
It maps `${TRIM_SERVICE_PORT}` to container port `51417`, mounts
`${TRIM_PKGVAR}` at `/app/config`, and preserves the runtime's current timezone
and `WEB_PASSWORD` defaults.

`config/resource` declares one stable Docker Compose project at path `docker`.
`config/privilege` uses the official package-user default. No data share or
filesystem authorization resource is required because the application only
uses its private runtime state.

`cmd/main` keeps `start` and `stop` as no-ops because fnOS manages the declared
Docker project. `status` inspects the stable
`douyu-keep-just-works` container name and returns the fnOS stopped status code
when it is not running.

`app/ui/config` registers an iframe entry on HTTP port `51417`. Package and
desktop icons are derived from the repository's existing 512 px `icon.png`.

## Version And Release Contracts

The called/manual workflow accepts `vMAJOR.MINOR.PATCH` and
`VMAJOR.MINOR.PATCH`, matching the existing Docker release contract. It strips
the prefix for the manifest, Docker image tag, and asset name. Before packaging it checks
that the exact Docker image exists with both `linux/amd64` and `linux/arm64`
manifests.

The workflow downloads official `fnpack 1.2.3` for Linux amd64 and validates
SHA256
`54b97fa7b70968c4d05c79840f5daeff508957d0bb2062fdb0376d00d9615c93`.
It builds from a runner-temporary copy so the checkout remains unchanged.

Output names are deterministic:

```text
douyu-keep-just-works-<version>-fnos.fpk
douyu-keep-just-works-<version>-fnos.fpk.sha256
```

The workflow uploads both as a GitHub Actions artifact. It creates the GitHub
Release from the existing tag when absent, then uploads both assets with
clobber semantics so a manual rebuild is idempotent.

## Compatibility And Security

The FPK is architecture-neutral; runtime compatibility comes from the existing
multi-architecture image. It does not embed or export user config.

The current application defaults `WEB_PASSWORD` to `password`; changing the
authentication product contract or adding an fnOS setup wizard is outside this
packaging task. Package documentation must make the inherited default visible
rather than imply a stronger default.

## Rollback

Removing the caller job from `docker.yml` stops future FPK publication without
affecting Docker image releases. The new workflow and `packaging/fnos/`
directory are otherwise isolated. Existing Release assets can be deleted
independently if a package is found invalid.

Physical fnOS installation remains a post-release manual validation because CI
has no fnOS device target.
