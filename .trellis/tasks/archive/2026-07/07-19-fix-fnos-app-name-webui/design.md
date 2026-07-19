# Technical Design

## Boundaries

The change is limited to the fnOS package template and its contract test. The Docker image and application WebUI remain unchanged.

## Package Data Flow

1. `wizard/config` defines `wizard_port` as a required numeric field with initial value `51417`.
2. `manifest.service_port` references `${wizard_port}`, making the chosen host port the fnOS service port.
3. fnOS exposes that service port as `${TRIM_SERVICE_PORT}` to the Docker Compose project.
4. Compose maps `${TRIM_SERVICE_PORT}:51417`; only the host side is configurable.
5. `app/ui/config` uses `type: url`, `protocol: http`, `port: ${wizard_port}`, and `url: /`, so the desktop shortcut opens the selected host port externally.

## Compatibility

- The package ID, entry ID, image name, container name, container listener, volume, and lifecycle behavior remain unchanged.
- Existing installs that retain their configured port continue to use that host mapping; the default only applies when the wizard initializes a new installation.
- No gateway socket or service-side port rewrite is introduced.

## Validation

The contract test will parse `wizard/config`, assert the default and numeric validation rule, assert `${wizard_port}` in the manifest and UI entry, assert `type: url`, and retain the Compose container-port checks.
