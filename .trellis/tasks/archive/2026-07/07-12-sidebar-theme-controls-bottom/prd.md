# Simplify Theme Controls and Anchor Them to the Sidebar Bottom

## Goal

Simplify the sidebar theme control to its three self-explanatory icon buttons and anchor the control to the bottom of the desktop sidebar.

## Background

- `SidebarNav.vue` currently renders a visible `主题模式` heading and a dynamic current-mode note around the icon buttons.
- `shell.css` gives the desktop sidebar viewport height, but the sidebar is not a column flex container and `.theme-box` only has a fixed top margin. The control is therefore last in document order rather than bottom-aligned.
- At widths up to 960 px, `responsive.css` changes the sidebar to static positioning and automatic height.

## Requirements

- Remove the visible theme heading and dynamic current-mode note from the sidebar control.
- Keep the existing light, dark, and system icon buttons, accessible labels, tooltips, selected state, saving state, and switching behavior.
- Use the sidebar's remaining vertical space to push the theme control to the bottom on desktop viewports.
- Preserve natural document flow on the responsive auto-height sidebar without adding artificial empty space.
- Preserve the order and behavior of all other sidebar content.

## Acceptance Criteria

- [x] The sidebar theme control shows no visible `主题模式` heading.
- [x] The sidebar theme control shows no dynamic `当前……` description.
- [x] All three theme buttons still switch modes and expose the correct active, busy, accessible-label, and tooltip states.
- [x] When the desktop sidebar is taller than its content, the theme control sits at the bottom of the sidebar's padded content area.
- [x] On the responsive auto-height sidebar, the theme control remains in normal flow after navigation without excessive blank space.
- [x] Frontend lint, type-check, and relevant build/tests pass.

## Out of Scope

- Changing theme persistence, resolution logic, icons, or colors.
- Refactoring unrelated sidebar layout or functionality.
