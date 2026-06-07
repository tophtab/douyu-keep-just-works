# Align Global Scrollbar Styling

## Goal

Make the Docker WebUI global scrollbar visually match the thinner, quieter scrollbar treatment already seen in the running log and cookie textarea surfaces, while preserving the current Vue/Vite frontend architecture. Keep transparent scrollbar tracks from exposing a mismatched root gutter color, and keep scrollbars inside rounded cookie/log surfaces clipped within the rounded frame.

## What I Already Know

- The user reports that neko scrollbars feel thinner than the current global WebUI scrollbars.
- The desired color reference is the scrollbar appearance inside the running log and cookie input areas.
- Existing global scrollbar CSS lives in `src/docker/webui/styles/base.css`.
- Running log and cookie inputs use standard overflow containers, so their scrollbar appearance comes from the global scrollbar rules.
- Current WebKit scrollbar width is `6px`; this can still look heavy because the full thumb is painted.
- Page-level scrollbars use the `html` element, so scrollbar variables defined only on `body[data-theme="dark"]` do not apply to the root viewport scrollbar.
- Neko uses only WebKit scrollbar pseudo-elements for Chromium/Blink and does not set global `scrollbar-width` or `scrollbar-color`; global non-default standard scrollbar properties can make browsers choose a native/classic scrollbar rendering path instead of the intended WebKit pseudo-element path.
- Extra scrollbar subpart resets were tried during debugging but are not part of the final neko-style implementation.

## Requirements

- Update global scrollbar styling so every scrollable surface uses the same subdued color family as the log box and cookie input.
- Keep the WebKit/Blink scrollbar shape aligned with neko: 6px slot, transparent track, rounded thumb, no thumb border.
- In light mode, match the neko structure and opacity rhythm while preserving project-owned colors.
- In dark mode, keep the same structure and opacity rhythm with dark-theme thumb colors.
- Do not keep Firefox-specific `scrollbar-width` / `scrollbar-color` compatibility because the requested reference does not include it.
- Remove temporary scrollbar subpart reset code that is not present in the reference implementation.
- Preserve light and dark theme scrollbar variables.
- Keep page-level and internal scrollbars on the same theme variables, including dark mode.
- Avoid component-specific scrollbar overrides for logs and cookie inputs; use structural clipping wrappers where rounded frames need to contain the scrollport.

## Acceptance Criteria

- [x] Global WebKit/Blink scrollbars use the neko-style 6px transparent-track shape.
- [x] Standard `scrollbar-width` and `scrollbar-color` are not present.
- [x] Extra scrollbar button, track-piece, corner, and resizer reset code is not present.
- [x] Global scrollbar track and thumb colors align with the existing log/cookie visual treatment in both light and dark themes.
- [x] The served HTML and runtime theme application set the current theme on `html` as well as `body`.
- [x] The root page gutter uses a theme-aware background so transparent tracks do not reveal mismatched colors.
- [x] Cookie textarea and running log scrollports are clipped by rounded outer frames so the scrollbar does not bleed past the container radius.
- [x] Vue component markup changes are limited to scrollport framing; no data-flow changes are introduced.
- [x] The only runtime change is theme attribute synchronization for `html` and `body`.
- [x] Frontend lint and type checks pass.

## Out of Scope

- Changing page layout beyond scrollport framing for rounded surfaces.
- Adding a JavaScript scrollbar library.
- Pixel-perfect cloning of third-party browser/UI behavior across every browser engine.

## Technical Notes

- Applicable frontend specs: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/directory-structure.md`, `.trellis/spec/frontend/quality-guidelines.md`.
- Neko-like thin scrollbars in the reference are achieved with only `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`, and `::-webkit-scrollbar-thumb:hover`.
