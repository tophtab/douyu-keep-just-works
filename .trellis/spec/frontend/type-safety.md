# Type Safety

> Type safety patterns in this project.

---

## Overview

The Docker WebUI uses TypeScript for Vue/Vite source under `src/docker/webui-src/`. Vue SFCs are checked with:

```bash
npm run type-check:webui
```

Shared backend/core TypeScript is checked separately through `tsconfig.docker.json`.

## Type Organization

- Put cross-runtime domain types in `src/core/types.ts`.
- Define UI-only interfaces next to the component or helper that owns them.
- Do not add `legacy-modules.d.ts` for Docker WebUI boot code; the production WebUI boot path is TypeScript-owned.

## Validation

- Use explicit runtime checks at API boundaries.
- Keep backend validation authoritative for persisted config and scheduled jobs.
- Parse loosely typed browser bootstrap values defensively, with sensible local fallbacks.

## Common Patterns

- Use explicit interfaces for runtime bootstrap data, such as `WebUiBootstrap`.
- Keep helper signatures explicit when they return promises or parsed API data.
- Prefer literal unions for page keys, task types, modes, and theme choices when Vue code starts owning those values.

## Forbidden Patterns

- Do not add a local copy of a shared type when `src/core/types.ts` already owns it.
- Do not use type assertions to skip validation when parsing config or external responses.
- Do not let Docker backend types and WebUI API assumptions drift apart without updating tests and specs.
