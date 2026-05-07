# Restore table alignment scheme

## Goal

Restore the WebUI tables to the clearer alignment/spacing scheme from the preferred earlier node, while preserving recent accessibility and semantic improvements.

## What I already know

* The supported WebUI is generated from `src/docker/html.ts`.
* The user pushed the previous WebUI polish work and then said the current table spacing still does not feel right.
* The user clarified this is not only the backpack table. Other tables should also return to the preferred earlier table scheme.
* The requested inventory-style column alignment includes:
  * `序号` centered.
  * Identity text such as `礼物`, `主播名称`, and `鱼吧名称` left aligned.
  * Identifier/numeric fields such as `ID`, `房间号`, and `鱼吧ID` right aligned.
  * `数量` right aligned.
  * `过期时间` left aligned with tabular/even-width numerals.
  * Comparable numeric fields such as `剩余`, `等级`, `排名`, `今日亲密度`, `亲密度`, `数量`, and `权重值` right aligned unless a control widget makes center alignment more readable.
  * Status/control columns such as `参与`, `临期`, `自动释放`, `双倍状态`, and `签到状态` centered.
* The work should not undo accessibility fixes, tab semantics, mobile card layout, scoped table headers, live regions, or other non-table improvements.

## Assumptions

* The latest `f6431aa` balanced percentage table spacing is not the desired result.
* The confirmed restoration target is `89901c8 style(webui): tighten identity column gaps`.
* The implementation should restore the table spacing/alignment behavior from `89901c8` while preserving any later non-conflicting accessibility or task metadata improvements.

## Requirements

* Restore the `89901c8` table spacing/alignment scheme across relevant Docker WebUI tables in `src/docker/html.ts`.
* Keep identity text columns readable and left aligned without forcing them to absorb excessive spacing.
* Keep identifiers and comparable numeric columns right aligned with tabular numerals.
* Keep time/date columns left aligned with tabular/even-width numeral rendering when that improves scanability.
* Keep status/control columns centered.
* Preserve the same alignment model between headers and body cells.
* Preserve existing API behavior, config shape, scheduler behavior, routes, and saved data.
* Do not add dependencies, a framework, or a separate frontend build step.

## Acceptance Criteria

* [ ] Relevant WebUI tables align consistently with the `89901c8` scheme.
* [ ] The current `f6431aa` spacing behavior is replaced where it caused oversized or visually uneven gaps.
* [ ] Existing accessible table semantics such as scoped headers and mobile data labels are preserved.
* [ ] `npm run lint` passes.
* [ ] `npm run type-check` passes.
* [ ] `npm run build:docker` or `npm test` passes.

## Definition of Done

* Changes are scoped to Docker WebUI code and this task documentation.
* Quality checks pass.
* Work is committed before finish-work.

## Out of Scope

* Starting a new table redesign beyond restoring the preferred earlier scheme.
* Changing backend route behavior or task execution semantics.
* Changing backpack data fetching or release logic.

## Technical Notes

* Primary file: `src/docker/html.ts`.
* Relevant spec: `.trellis/spec/frontend/index.md`.
* Table CSS is near `src/docker/html.ts` table styles.
* Backpack row/header generation is in `buildBackpackRowsTable`.
* Recent relevant commits include:
  * `ca59df0 style(webui): tighten list table alignment`
  * `89901c8 style(webui): tighten identity column gaps` (confirmed target)
  * `f6431aa style(webui): balance table column spacing`
* The key source diff to revert is `git diff 89901c8..HEAD -- src/docker/html.ts`, especially table colgroup widths around the table CSS and `buildGiftListTable`.
