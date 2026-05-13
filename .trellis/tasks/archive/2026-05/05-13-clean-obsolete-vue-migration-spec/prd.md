# Clean Obsolete Vue Migration Spec

## Goal

Remove the outdated frontend spec guidance that still frames future Docker WebUI Vue work as a first-migration-only, gradual extraction constraint.

## Context

- The user noticed the current spec may be encouraging overly small edits.
- The relevant rule is in `.trellis/spec/frontend/component-guidelines.md`.
- This is a local Trellis spec maintenance change, not an application behavior change.

## Requirements

- Remove the outdated first-migration guidance that says future work should gradually extract cohesive components from `App.vue` instead of redesigning every page at once.
- Keep useful component guidance that still applies, including ownership clarity and avoiding unnecessary deep component trees.
- Do not change runtime code.

## Acceptance Criteria

- [x] `.trellis/spec/frontend/component-guidelines.md` no longer contains the outdated first Vue migration sentence.
- [x] Remaining wording allows larger coherent UI changes when a task calls for them.
- [x] No application source files are changed for this task.

## Out of Scope

- Changing the Trellis workflow phase rules.
- Changing application runtime code.
- Broad spec rewrites unrelated to this obsolete rule.
