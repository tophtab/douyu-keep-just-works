# continue large file splitting

## Goal

Continue reducing the largest source files after the first 2026-05-12 split, with behavior-preserving file extraction that keeps the Docker WebUI deployment model unchanged.

## What I already know

* The user said the files are still too large and asked to continue splitting.
* Current biggest source files are `src/docker/webui/app.js` (2809 lines), `src/docker/runtime.ts` (1128 lines), and `src/docker/webui/styles.css` (1084 lines).
* The project intentionally serves one injected HTML document from `src/docker/webui.ts`; split CSS/JS source files must still be injected, not mounted as separate static routes.
* The previous task introduced ordered WebUI JavaScript injection with `app-data.js`, `app-routing.js`, and `app.js`.
* This task split the WebUI CSS into ordered source files and reduced the main WebUI script from 2809 lines to under 1000 lines.

## Requirements

* Continue splitting large files without changing user-visible behavior.
* Prefer low-risk boundaries first: CSS source chunks and pure WebUI helpers before scheduler/runtime refactors.
* Keep `index.html` as the WebUI shell and keep `src/docker/webui.ts` responsible for injecting ordered source assets.
* Update existing contract tests/specs to reflect new split files.
* Do not add the broad runtime executable-test suite as part of this task.

## Acceptance Criteria

* [x] `src/docker/webui/styles.css` is split into smaller ordered CSS source files.
* [x] `src/docker/webui/app.js` is reduced further by moving pure utility/helper logic to separate ordered scripts.
* [x] No large-file split changes Docker deployment shape or adds static asset routes.
* [x] Existing quality gates pass: `npm run lint`, `npm run type-check`, `npm test`.
* [x] Source line-count summary improves materially for the largest files.

## Definition of Done

* Behavior-preserving refactor only.
* Contract tests updated for split asset injection.
* Trellis specs updated if the WebUI source split convention changes.
* Work committed and task archived.

## Out of Scope

* Rewriting WebUI with a framework or bundler.
* Broad runtime behavior test foundation.
* Deep `src/docker/runtime.ts` scheduler/cache refactor unless time remains after safer WebUI splits.

## Technical Notes

* Applicable specs: `.trellis/spec/frontend/index.md`, `.trellis/spec/backend/directory-structure.md`, `.trellis/spec/backend/quality-guidelines.md`.
* Current scripts: `npm run lint`, `npm run type-check`, `npm test`.
* Final notable source line counts: `src/docker/runtime.ts` 1128, `src/docker/webui/app.js` 926, `src/docker/webui/app-actions.js` 750, `src/docker/webui/app-pages.js` 681, `src/docker/webui/styles.css` 351.
