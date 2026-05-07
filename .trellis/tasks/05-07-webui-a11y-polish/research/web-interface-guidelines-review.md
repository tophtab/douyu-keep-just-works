# Web Interface Guidelines review notes

Source reviewed on 2026-05-07:
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Findings to implement

* `src/docker/html.ts:2083` uses curly attribute quotes in generated HTML. Replace with valid straight quotes.
* Buttons, tab buttons, and switch controls need visible `:focus-visible` styles.
* Toast/status messages need `aria-live="polite"` or an equivalent `role="status"` live region.
* Switch controls need accessible names, especially task enable/disable switches.
* Sidebar tab navigation should expose selected state and controlled panels via ARIA.
* Dynamic table checkbox and number inputs need row-specific accessible names.
* Destructive clear logs confirmation/undo was proposed by the guideline review, but the user explicitly rejected it. Keep current behavior.
* Forms should have meaningful `name`, accurate `type`, autocomplete choices, and input constraints where low-risk.
* Loading states should use `…` instead of `...`.
* Theme should expose `theme-color` and `color-scheme` so browser UI/native controls match the selected theme.
* Motion should honor `prefers-reduced-motion`.

## Follow-up list/table review

* Current tables rely heavily on fixed min-width and horizontal scrolling. This is acceptable for editable configuration tables, but status/detail lists should be more readable on small screens where practical.
* Key text cells should not all be forced into one-line ellipsis. Streamer names, fish-bar names, gift names, and row-level error details need either wrapping, titles/ARIA labels, or a compact mobile representation.
* Numeric comparison columns should use tabular numerals for scanability.
* Double-card configuration should emphasize participation. The user specifically requested the double-card table column order to be `参与`, then `序号`, then the remaining columns.

## Implementation constraints

* Keep `src/docker/html.ts` as the Docker WebUI source.
* Do not add dependencies or a framework.
* Do not change route/API behavior.
* Keep the clear-logs interaction immediate.
