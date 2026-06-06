# Update WebUI Project Description

## Goal

Change the WebUI project description from `斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到` to `斗鱼荧光棒|续粉丝牌|检测双倍|鱼吧签到`.

## What I Already Know

- The visible description is rendered in `src/docker/webui/components/SidebarNav.vue`.
- `test/project-maintenance-contract.test.js` contains a contract assertion for this WebUI description.

## Requirements

- Update the WebUI description text to exactly `斗鱼荧光棒|续粉丝牌|检测双倍|鱼吧签到`.
- Update matching tests or contract assertions that encode the old text.
- Do not alter unrelated WebUI behavior or layout.

## Acceptance Criteria

- [x] No source or test file still expects `斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到`.
- [x] Type-check or targeted verification passes for the changed WebUI contract.

## Definition of Done

- Relevant code and test assertions are updated.
- Project quality checks relevant to the change are run.

## Out of Scope

- Changing README/package metadata.
- Redesigning the navigation UI.

## Technical Notes

- Located via `rg` in `src/docker/webui/components/SidebarNav.vue` and `test/project-maintenance-contract.test.js`.
