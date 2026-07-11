# 固定侧边栏

## Goal

Keep the Docker WebUI sidebar visible while users scroll long page content, matching the persistent desktop navigation behavior referenced by the user.

## Background

- The authenticated WebUI uses a flex shell with `.sidebar` and `.main` in `src/docker/webui/styles/shell.css`.
- The sidebar currently participates in normal document flow, so it scrolls out of view with the main content.
- At viewport widths up to 960px, `src/docker/webui/styles/responsive.css` changes the shell to a stacked mobile layout.

## Requirements

- On desktop widths above the existing 960px responsive breakpoint, keep the sidebar anchored to the viewport while the document scrolls.
- Allow the sidebar itself to scroll vertically when its content is taller than the viewport, so every navigation and theme control remains reachable.
- Preserve the existing sidebar width, appearance, navigation behavior, and main-content layout.
- Preserve the current stacked layout at widths up to 960px; the sidebar must return to normal document flow on small screens.
- Respect the browser viewport without introducing a second unnecessary page-wide scrollbar or covering the main content.

## Acceptance Criteria

- [x] At a viewport wider than 960px, scrolling a long page does not move the sidebar out of view.
- [x] At a viewport wider than 960px with a short viewport height, all sidebar controls remain reachable by scrolling within the sidebar.
- [x] At a viewport width of 960px or less, the sidebar remains in the existing stacked responsive layout and does not become a fixed overlay.
- [x] The main content remains usable and does not render underneath the sidebar.
- [x] Frontend type-check/build and relevant project checks pass.

## Out of Scope

- Redesigning navigation content, colors, spacing, typography, or theme controls.
- Adding a collapsible desktop sidebar or mobile drawer.
- Changing page routing or tab behavior.
