# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality in this project is based on:

- Vue 3 + TypeScript SFCs
- Vite production bundling into the Docker build output
- ESLint via `@antfu`
- contract tests for Docker WebUI build/serving assumptions
- manual smoke testing, because there is no full browser automation suite yet

## Required Patterns

- Use `<script setup lang="ts">` for Vue SFCs.
- Keep Vite output under `build/docker/docker/webui`.
- Keep Vue/Vite dependencies in `devDependencies` unless runtime Node imports them directly.
- Preserve current Chinese user-facing copy during framework-only migrations.
- Preserve route URLs from `DOCKER_WEBUI_PAGE_ROUTES`.

## Forbidden Patterns

- Do not introduce a custom UI abstraction layer before repeated components justify it.
- Do not move Vite dev server into production Docker runtime.
- Do not let `npm run build:docker` depend on prebuilt local artifacts.
- Do not broaden lint/test scopes to unrelated archived Trellis or generated build output.

## Testing Requirements

Current expected checks:

- `npm run lint`
- `npm run type-check`
- `npm run build:webui` for frontend source changes
- `npm test` for contract tests plus Docker build

For UI work, manually verify:

- page loads without console-breaking errors
- route navigation still works for deep-linked WebUI paths
- login, form validation, save flows, and task actions still behave correctly
- job progress, loading states, and logs still update visibly

## Code Review Checklist

- Does the change preserve Docker-only runtime boundaries?
- Are Vue/Vite dependencies builder-time only when possible?
- Are shared API/data contracts covered by tests or specs?
- Are loading, error, and success states still visible to the user?
