# Technical Design

## Boundaries

The change is limited to the fnOS package template and its contract test. The Docker image and application WebUI remain unchanged.

## Package Data Flow

1. `manifest.service_port` remains `51417`.
2. fnOS exposes that service port as `${TRIM_SERVICE_PORT}` to the Docker Compose project.
3. Compose maps `${TRIM_SERVICE_PORT}:51417`.
4. `app/ui/config` uses `type: url`, `protocol: http`, `port: 51417`, and `url: /`, so the desktop shortcut opens the WebUI externally.

## Compatibility

- The package ID, entry ID, image name, container name, container listener, volume, and lifecycle behavior remain unchanged.
- No gateway socket or service-side port rewrite is introduced.

## Validation

The contract test will assert the fixed `51417` service port, `type: url`, and retain the Compose container-port checks.
