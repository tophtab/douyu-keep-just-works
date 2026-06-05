# Align manual save button style

## Goal

Make the "手填保存" button visually align with the existing "同步并校验" button so the login settings page uses a consistent button style for these secondary validation/save actions.

## What I already know

* The user confirmed the desired interpretation: "手填保存" should reference the "同步并校验" button style.
* `src/docker/webui/components/LoginConfigPage.vue` renders both buttons through `ActionBar`.
* `ActionBar` maps `kind` values to global `.btn-*` classes.
* "同步并校验" currently uses `kind: 'secondary'`; "手填保存" currently uses `kind: 'success'`.

## Assumptions

* The intended change is visual only.
* Save, scan login, CookieCloud, and validation behavior should remain unchanged.
* Existing global button variants should be reused instead of adding one-off CSS.

## Requirements

* Change "手填保存" to use the same visual button variant as "同步并校验".
* Preserve all button labels, ordering, and click behavior.
* Avoid new custom CSS unless the existing button system cannot express the desired style.

## Acceptance Criteria

* [ ] "手填保存" renders with the same `secondary` ActionBar style as "同步并校验".
* [ ] No behavior changes are introduced for manual cookie save.
* [ ] Frontend lint/type checks pass for the touched Vue code.

## Definition of Done

* Focused code change completed.
* Relevant frontend checks run.
* Task context reflects the spec files used.

## Out of Scope

* Redesigning the login page.
* Changing CookieCloud or manual cookie business logic.
* Changing global button colors or variants.

## Technical Notes

* Relevant component: `src/docker/webui/components/LoginConfigPage.vue`.
* Relevant reusable component: `src/docker/webui/components/ActionBar.vue`.
* Relevant styles: `src/docker/webui/styles/components.css`.
