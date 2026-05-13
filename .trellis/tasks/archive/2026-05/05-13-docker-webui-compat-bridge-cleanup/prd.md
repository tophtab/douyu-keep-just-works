# Clean up Docker WebUI Vue compatibility bridge

## Goal

Continue the Docker WebUI Vue migration cleanup after the production boot migration is complete by removing misleading legacy-template residue that is no longer part of the Vite production entry.

## What I already know

- Production WebUI boot now enters through `src/docker/webui-src/index.html`, `main.ts`, TypeScript bridge installers, and `startLegacyApp()`.
- `src/docker/webui-src/main.ts` no longer dynamically imports `../webui/app*.js`.
- `src/docker/webui/` no longer has source files after the cleanup; production `webui/` assets are generated under `build/docker/docker/webui/`.
- The `legacy-*` files and `DOUYU_KEEP_WEBUI_*` bridge names under `src/docker/webui-src/` are still covered by specs and contract tests as transitional TypeScript compatibility APIs.

## Assumptions

- This task should not rename or remove the TypeScript compatibility bridge layer yet, because that requires a broader contract/spec update.
- The safest next migration cleanup is to make the non-production old HTML template stop looking like a live UI implementation.

## Requirements

- Remove the stale `src/docker/webui/index.html` source placeholder after the real production source has moved to `src/docker/webui-src/index.html`.
- Move the shared `styles*.css` source files from `src/docker/webui/` into the Vue/Vite source tree under `src/docker/webui-src/styles/`.
- Extract cohesive Vue components from `App.vue` without changing visual design or user-facing copy.
- Keep runtime token placeholders and Docker/Vite build behavior intact for the real production WebUI path.
- Do not reintroduce deleted `app*.js` boot imports or legacy JS boot paths.
- Keep existing Vue/WebUI TypeScript compatibility bridges unchanged unless a verification failure requires a narrow adjustment.

## Acceptance Criteria

- [x] `src/docker/webui/index.html` no longer contains stale tab/trigger markup such as `data-action="tab"` or `data-action="trigger"`.
- [x] `src/docker/webui/` no longer contains source files after the file-cleanup phase.
- [x] Shared WebUI CSS source lives under `src/docker/webui-src/styles/` and `main.ts` imports it from there.
- [x] The login shell is extracted into a Vue component while preserving the existing login behavior and markup semantics.
- [x] Production build still uses `src/docker/webui-src/index.html` and produces the Docker WebUI shell.
- [x] Lint/type-check/contracts relevant to the change pass.
- [x] Existing uncommitted Trellis update files are not reverted or mixed into the migration cleanup.

## Definition of Done

- Tests/checks run: at least contract tests and WebUI/Docker type-check or full `npm test` when feasible.
- Specs reviewed for whether the cleanup reveals documentation that should be updated.
- Work is committed separately from unrelated Trellis update files if a commit is made.

## Out of Scope

- Renaming `legacy-app.ts`, `legacy-core.ts`, `legacy-state.ts`, or `installLegacy*Bridge()` APIs.
- Replacing `DOUYU_KEEP_WEBUI_*` compatibility window interfaces.
- Renaming compatibility bridge modules that now live under `src/docker/webui-src/`.
- Broad documentation rewrite of historical Trellis task PRDs.

## Technical Notes

- `vite.config.ts` sets `root: 'src/docker/webui-src'` and `input: 'index.html'`.
- `src/docker/webui.ts` reads the built `webui/index.html` from `WEBUI_ASSET_ROOT`; in production this is the Vite output under `build/docker/docker/webui/index.html`.
- Contract tests currently assert that the TypeScript compatibility bridges still exist, so bridge renaming is intentionally deferred.
