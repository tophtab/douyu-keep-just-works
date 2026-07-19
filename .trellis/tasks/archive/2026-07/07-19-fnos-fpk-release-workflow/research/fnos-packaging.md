# fnOS Docker Packaging Research

## Official Contracts

Sources:

- <https://developer.fnnas.com/docs/examples/docker/>
- <https://developer.fnnas.com/docs/cli/fnpack/>
- <https://developer.fnnas.com/docs/core-concepts/manifest/>
- <https://developer.fnnas.com/docs/core-concepts/resource/>
- <https://developer.fnnas.com/docs/core-concepts/environment-variables/>
- <https://developer.fnnas.com/docs/core-concepts/app-entry/>

The official Docker template places Compose at
`app/docker/docker-compose.yaml`, declares it through
`config/resource` under `docker-project`, and uses fnOS-provided environment
variables for the service port and durable runtime paths. A package without
native binaries may declare `platform=all`, but its Docker image must support
the target architectures. `cmd/main status` should return `0` for a running
representative container and `3` otherwise.

The port entry contract requires the same port in `manifest.service_port`, the
Compose host mapping, and `app/ui/config`. The selected design uses port
`51417`, matching the maintained Docker runtime, and does not use the optional
Unix-socket gateway.

`fnpack 1.2.3` is the current official Linux x86 build documented by fnOS. The
download at
`https://static2.fnnas.com/fnpack/fnpack-1.2.3-linux-amd64` was independently
hashed on 2026-07-19:

```text
54b97fa7b70968c4d05c79840f5daeff508957d0bb2062fdb0376d00d9615c93
```

## Community Workflow Comparison

Sources:

- <https://github.com/haierkeys/fast-note-sync-service/blob/master/.github/workflows/build-fnos-fpk.yml>
- <https://github.com/52sanmao/fast-note-sync-fnos/blob/main/.github/workflows/build.yml>
- <https://github.com/QYG2297248353/DPanel-Offline-FnNas/blob/main/.github/workflows/release-fnpack.yml>
- <https://github.com/sushazhi/fnos-transmission/blob/main/.github/workflows/build-and-release.yml>

Useful repeated practices are strict version resolution, manifest stamping in
a temporary packaging directory, deterministic package names, workflow
artifact retention, release attachment, and checksum generation. The
haierkeys workflow additionally pins the verified `fnpack` SHA256 and is the
strongest reference for tool-supply-chain handling.

Architecture-specific packages in these examples carry native binaries. This
project's FPK carries only Compose metadata and icons, while the existing tag
workflow publishes a multi-architecture Docker image. A single `platform=all`
package is therefore the appropriate shape.

## Repository Constraints

- `Dockerfile` exposes `51417` and runs the Node Docker WebUI.
- `docker-compose.yml` names the representative container
  `douyu-keep-just-works` and persists `/app/config`.
- `.github/workflows/docker.yml` publishes `linux/amd64` and `linux/arm64`
  digests, then combines them into `<version>` and `latest` manifests.
- Release ordering must be explicit. Two independent tag-triggered workflows
  would race, so the existing Docker workflow should call the reusable FPK
  workflow only after `release-manifest` succeeds.
