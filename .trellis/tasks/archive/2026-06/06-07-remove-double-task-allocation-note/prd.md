# Remove double task allocation note

## Goal

Remove the weight-mode allocation help sentence from the double task page so the "分配说明" area no longer shows "按权重模式不要求总和等于 100。多个房间同时开双倍时，只会在这些房间里按权重值重新分配。" Also reserve desktop scrollbar space so long and short WebUI pages keep consistent card widths.

Unify authenticated WebUI config reads so `/api/config` returns the complete editable config and replaces the previous `/api/config/raw` business path. Keep `/api/overview` as the safe summary endpoint that does not expose cookie values.

## What I already know

* The requested text is rendered from `doubleModeHelp` in `src/docker/webui/double.ts`.
* The "分配说明" area is rendered by `src/docker/webui/components/DoublePage.vue`.
* The request is copy-only for the weight-mode help line; no allocation behavior should change.
* The scrollbar shown in the screenshot is the page/browser scrollbar; the draggable part is the scrollbar thumb.
* `neko-master` handles the long-page width shift by applying `overflow-y: scroll` and `scrollbar-gutter: stable` to `html` under `@media (pointer: fine)`.
* Passport Cookie appearing as `dy_did=...` after tab switches is caused by masked `/api/config` responses being written into the same frontend config state as raw config.
* The user confirmed the new contract: authenticated `/api/config` returns complete config, `/api/config/raw` is removed, frontend config reads use `/api/config`, and `/api/overview` remains summary-only.

## Requirements

* Remove the quoted weight-mode help sentence from the double task page.
* Reserve desktop page scrollbar space using the `neko-master` approach.
* Replace `/api/config/raw` with full authenticated `/api/config` reads.
* Return full config from successful `/api/config` mutations so frontend state is not polluted by masked config.
* Update frontend config loading to call `/api/config`.
* Update contract tests for the new config route contract.
* Preserve fixed-count mode help and loading/empty-room help copy.
* Do not change double task allocation logic, config shape, or API behavior.

## Acceptance Criteria

* [x] In weight mode with available room rows, the quoted sentence is not rendered.
* [x] Other double task allocation help states continue to render when applicable.
* [x] Desktop pages reserve vertical scrollbar space so content width does not shift between long and short pages.
* [x] Authenticated `GET /api/config` returns the complete config previously served by `/api/config/raw`.
* [x] `GET /api/config/raw` is no longer registered.
* [x] Successful `POST /api/config` returns complete config so WebUI form state remains complete after saves.
* [x] `/api/overview` remains summary-only and does not expose raw Cookie values.
* [x] Frontend lint and WebUI type-check pass.

## Definition of Done

* Relevant frontend specs read before implementation.
* Code change is focused on the requested UI copy and desktop scrollbar-width stabilization.
* Config route contract tests are updated to match the simplified authenticated config API.
* Lint and type-check results are recorded in the final response.

## Out of Scope

* Changing how weights are calculated or validated.
* Redesigning the allocation explanation panel.
* Customizing scrollbar appearance.
* Redesigning cards or changing page layout structure.

## Technical Notes

* Frontend spec files read: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/quality-guidelines.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/type-safety.md`.
* Shared guide index read: `.trellis/spec/guides/index.md`.
