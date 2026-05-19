# WebUI Project Title Link

## Goal

Make the `douyu-keep` brand text in the Docker WebUI clickable so users can open the project repository from the interface.

## What I Already Know

* The user wants clicks on the WebUI `douyu-keep` string to navigate to their project address.
* The displayed app name is injected through `window.DOUYU_KEEP_WEBUI_BOOTSTRAP.appName`, defaulting to `douyu-keep` in `src/docker/webui/App.vue`.
* The brand text is rendered in `src/docker/webui/components/SidebarNav.vue`.
* The repository URL in `package.json` is `https://github.com/tophtab/douyu-keep-just-works.git`.

## Decisions

* The project address is `https://github.com/tophtab/douyu-keep-just-works`.
* The link should open in a new browser tab/window so the running WebUI session is not replaced.

## Open Questions

* None.

## Requirements

* Render the existing brand text as a link without changing the displayed app name.
* Point the link to `https://github.com/tophtab/douyu-keep-just-works`.
* Preserve the current sidebar layout and visual hierarchy.
* Use accessible link behavior, including a useful label and safe external-link attributes when opening a new tab.

## Acceptance Criteria

* [x] Clicking the `douyu-keep` brand text opens the project URL.
* [x] The displayed text remains `douyu-keep` when bootstrap data provides that app name.
* [x] The version badge and sidebar navigation layout remain visually stable.
* [x] WebUI type-check passes.

## Definition of Done

* Lint/type-check/build checks run as appropriate for the touched frontend surface.
* No backend behavior or config shape changes.
* No docs update unless implementation reveals a user-visible detail worth documenting.

## Out of Scope

* Adding a general settings field for project URL.
* Changing the app name, version label, or sidebar navigation.
* Adding analytics or tracking for the link click.

## Technical Notes

* Likely files: `src/docker/webui/components/SidebarNav.vue`, possibly `src/docker/webui/styles/shell.css`.
* Frontend specs apply under `.trellis/spec/frontend/`.
