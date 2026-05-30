# Split Runtime Composition Root

## Goal

Refactor the Docker backend runtime so `src/docker/runtime.ts` becomes a focused composition root that starts the process and wires services, while runtime business rules live in focused sibling modules.

## Scope

- Keep current Docker runtime behavior unchanged.
- Move WebUI `AppContext` construction out of `runtime.ts`.
- Move cookie credential recovery wiring out of `runtime.ts`.
- Move fan medal synchronization / config reconcile / cookie snapshot merge logic out of `runtime.ts`.
- Preserve existing `runtime-config-service.ts`, `runtime-cookie-cloud-sync.ts`, and `runtime-scheduler.ts` responsibilities.
- Add or update focused architecture contract tests when useful to prevent `runtime.ts` from regressing into business logic.

## Non-Goals

- No frontend UI changes.
- No config shape changes.
- No task behavior changes.
- No new persistence mechanism.

## Acceptance Criteria

- `runtime.ts` mostly wires runtime dependencies, startup order, shutdown handlers, and service lifecycle.
- Business rules for cookie recovery and fans sync are exported from focused runtime modules.
- `AppContext` construction is exported from a focused runtime module.
- Existing lint, type-check, and relevant tests pass.
