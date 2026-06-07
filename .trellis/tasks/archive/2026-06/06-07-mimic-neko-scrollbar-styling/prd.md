# Mimic neko scrollbar styling

## Goal

Adjust the Docker WebUI scrollbar shape to follow the `foru17/neko-master` scrollbar treatment while keeping this project's existing scrollbar color variables. This should fix the current overly solid scrollbar appearance across scrollable surfaces.

## What I already know

* The previous scrollbar fix added global scrollbar rules in `src/docker/webui/styles/base.css`.
* Current WebUI scrollbars use a 12px WebKit scrollbar, a visible track background, and a thumb border using the track color.
* The user reports that all scrollbars look like solid bars.
* The requested reference is `https://github.com/foru17/neko-master`.
* `neko-master` defines a global custom scrollbar in `apps/web/app/globals.css`.

## Assumptions

* The scrollbar treatment should remain global so page, textarea, table, and log scrollbars stay visually consistent.
* "Except color" means keep the current WebUI light/dark `--scrollbar-*` variables, not the blue-gray colors from `neko-master`.
* The page-level stable gutter behavior can remain, because `neko-master` also reserves scrollbar gutter on fine pointers.

## Requirements

* WebUI scrollbars should use the `neko-master` shape: narrow 6px scrollbar, transparent track, rounded thumb, no track-colored thumb border.
* Existing light and dark scrollbar thumb colors should remain controlled by this project's CSS variables.
* Hover color behavior should remain.
* Cookie textareas must remain fixed-height, non-resizable, and scrollable.
* No Vue component behavior, bindings, labels, or API behavior should change.

## Acceptance Criteria

* [x] Scrollbars no longer render as wide solid tracks.
* [x] WebKit scrollbar width and height are 6px.
* [x] WebKit scrollbar track is transparent.
* [x] WebKit scrollbar thumb has rounded corners without a track-colored border.
* [x] Firefox scrollbar color uses a transparent track and the project thumb color.
* [x] Frontend lint and WebUI type-check pass, or any inability to run them is documented.

## Definition of Done

* Read relevant frontend specs before editing.
* Record external reference findings under `research/`.
* Keep the implementation focused to global WebUI CSS.
* Run frontend verification commands appropriate for CSS-only visual work.
* Record whether a spec update is needed.

## Out of Scope

* Changing WebUI theme colors.
* Redesigning any page layout.
* Changing Cookie save, QR login, CookieCloud, backend APIs, or config behavior.

## Technical Notes

* Relevant project file: `src/docker/webui/styles/base.css`.
* Existing cookie textarea file remains relevant: `src/docker/webui/styles/components.css`.
* External reference cloned to `/tmp/neko-master-scrollbar`.
* External reference CSS: `/tmp/neko-master-scrollbar/apps/web/app/globals.css`.
* Research artifact: `.trellis/tasks/06-07-mimic-neko-scrollbar-styling/research/neko-scrollbar-css.md`.
* Frontend specs read:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/directory-structure.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/index.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
* Verification run:
  * `npm run lint`
  * `npm run type-check:webui`
  * `npm run build:webui`
