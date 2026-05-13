# Frontend Page Logic Deduplication

## Goal

Reduce duplicated Docker WebUI frontend code by extracting shared page-task behavior into reusable Vue composables and small helpers. The goal is real simplification: fewer repeated branches and request flows, clearer ownership boundaries, and smaller page modules without changing user-visible behavior.

## What I Already Know

* The largest frontend files are page composables and transitional legacy bridges, not Vue SFC templates.
* `src/docker/webui-src/resources.ts` mixes date formatting, logs, config/overview resource loading, fans resource loading, and legacy resource bridges.
* `src/docker/webui-src/collect.ts`, `keepalive.ts`, `double.ts`, `expiring.ts`, `yuba.ts`, and `cookie.ts` repeat cron preview state, request sequencing, error formatting, unauthorized handling, legacy event wiring, and task trigger/config-save flows.
* Existing Vue components are relatively small; most complexity sits in `.ts` composables.
* `main.ts` currently owns legacy bridge import/install order while the transition layer exists.
* The frontend spec requires Docker WebUI code to remain under `src/docker/webui-src/`, continue Vue/Vite migration patterns, and preserve Docker deployment semantics.

## Assumptions

* This refactor should preserve all API endpoints, event names, legacy `window.DOUYU_KEEP_WEBUI_*` bridge names, and current UI text.
* The first pass should focus on duplication that appears in at least three files.
* Splitting files is allowed only when it also improves reuse or isolates transitional legacy code.
* Large behavioral redesigns, store adoption, and new dependencies are out of scope.

## Open Questions

* Should the first implementation pass prioritize a conservative helper extraction with minimal file movement, or a stronger module reshaping that also moves bridge code into `legacy/` modules?

## Requirements

* Extract shared cron preview behavior used by task pages and CookieCloud.
* Extract common error message handling and unauthorized-error delegation where practical.
* Extract repeated legacy page event subscription patterns.
* Reduce repeated task action boilerplate for save/disable/trigger flows where a shared helper keeps call sites readable.
* Keep page-specific domain logic local to each page module unless it is demonstrably shared.
* Preserve existing exported composable names used by Vue components.
* Preserve existing legacy bridge install functions used by `main.ts`.
* Avoid introducing Pinia, a new UI framework, or new runtime dependencies.

## Acceptance Criteria

* [ ] `collect.ts`, `keepalive.ts`, `double.ts`, `expiring.ts`, `yuba.ts`, and `cookie.ts` no longer each define their own full cron preview request sequencing logic.
* [ ] Repeated `document.addEventListener` / `removeEventListener` page event wiring is centralized or significantly reduced.
* [ ] Existing user-facing behavior, request endpoints, event names, and legacy bridge names remain compatible.
* [ ] TypeScript type-check passes.
* [ ] Existing frontend/build contract tests pass, or any skipped checks are explicitly documented.
* [ ] The final line-count report shows real reduction in repeated page modules, not only file relocation.

## Definition of Done

* Lint / typecheck / relevant tests pass.
* Refactor keeps behavior compatible with the current Docker WebUI.
* Any new helper/composable follows frontend hook and state guidelines.
* No unrelated UI redesign or backend behavior change is included.

## Out of Scope

* Removing the legacy app bridge entirely.
* Replacing the existing state model with Pinia or another store.
* Redesigning the UI layout or copy.
* Changing backend API contracts.
* Rewriting all page modules in one pass if a narrower deduplication pass gives most of the benefit.

## Technical Notes

* Relevant files inspected:
  * `src/docker/webui-src/resources.ts`
  * `src/docker/webui-src/collect.ts`
  * `src/docker/webui-src/keepalive.ts`
  * `src/docker/webui-src/double.ts`
  * `src/docker/webui-src/expiring.ts`
  * `src/docker/webui-src/yuba.ts`
  * `src/docker/webui-src/cookie.ts`
  * `src/docker/webui-src/main.ts`
  * `src/docker/webui-src/components/*.vue`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
* Candidate shared modules:
  * `src/docker/webui-src/composables/useCronPreview.ts`
  * `src/docker/webui-src/composables/useLegacyPageEvents.ts`
  * `src/docker/webui-src/tasks/shared.ts`
  * Later, possibly `src/docker/webui-src/legacy/*` for bridge isolation.
