# 将侧边栏版本号改为标题角标

## Goal

Present the application version as a compact badge attached to the upper-right
of the `douyu-keep` sidebar title, so the brand block reads as one visual unit
instead of placing the version in a separate row.

## Background

- The sidebar brand is rendered by `src/docker/webui/components/SidebarNav.vue`.
- The current `.brand-row` flex layout allows the version pill to wrap below
  the title when horizontal space is insufficient.
- The version value remains supplied by the existing `versionLabel` prop.

## Requirements

- Keep the logo, project title link, and version text unchanged.
- Position the version badge at the upper-right corner of the title area.
- Make the badge visually smaller and lighter than the title while retaining
  the existing accent-color styling.
- The badge must not create a separate row or disturb the sidebar navigation
  layout.
- Preserve the title link's hover, focus, and accessibility behavior.

## Acceptance Criteria

- [ ] The version appears as a compact upper-right badge attached to the
  `douyu-keep` title area.
- [ ] The former standalone/wrapping version pill placement is removed.
- [ ] The brand block remains readable without overlap in the maintained
  sidebar layout.
- [ ] The frontend type-check/build and relevant lint checks pass.

## Out of Scope

- Changing the version source or release process.
- Redesigning the logo, title, sidebar navigation, or login-page branding.
