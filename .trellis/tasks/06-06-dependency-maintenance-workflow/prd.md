# dependency maintenance workflow

## Goal

Execute the low-risk dependency maintenance batch identified in the project optimization roadmap, keeping production dependency changes and cautious compiler-tooling changes out of this task.

## What I already know

* The reference roadmap is `.trellis/tasks/06-06-project-optimization-opportunities/prd.md`, section `H. Dependency maintenance workflow`.
* The project uses npm with `package-lock.json`.
* `package.json` constrains Node to `>=24 <25`; package-lock root metadata carries the same engine constraint.
* The user explicitly requested a new Trellis task for this maintenance work and asked not to modify the old task status.
* The user requested conservative execution: only safe dev/tooling patch/minor updates, no broad dependency sweep, and no `npm audit fix --force`.

## Requirements

* Update only the following resolved direct dependency versions:
  * `@types/node` `24.12.3` -> `24.13.1`
  * `@vitejs/plugin-vue` `6.0.6` -> `6.0.7`
  * `eslint` `10.3.0` -> `10.4.1`
  * `vite` `8.0.12` -> `8.0.16`
  * `vue` `3.5.34` -> `3.5.35`
* Keep `@types/node` on the Node 24 typings line. Do not upgrade to Node 25 typings while the project engine remains `>=24 <25`.
* Do not upgrade `axios` in this task. Leave `axios` `1.16.0` -> `1.17.0` for a separate cautious production-dependency task.
* Do not upgrade `vue-tsc` in this task by default. Treat `vue-tsc` `3.2.8` -> `3.3.3` as a cautious compiler-tooling update for separate handling unless there is a clear reason to include it.
* Do not run `npm audit fix --force`.
* Update both `package.json` and `package-lock.json` as needed.
* After the update, run:
  * `npm run lint`
  * `npm run type-check`
  * `npm run test:contracts`
  * `npm test`
* Update section `H. Dependency maintenance workflow` in `.trellis/tasks/06-06-project-optimization-opportunities/prd.md` with:
  * the dependency updates executed in this task
  * validation commands and results
  * remaining decisions for `axios`, `vue-tsc`, and Node 25 typings

## Acceptance Criteria

* [ ] `package.json` and `package-lock.json` reflect only the intended low-risk dev/tooling batch.
* [ ] `@types/node` resolves to `24.13.1`, not a Node 25 version.
* [ ] `axios` remains on `1.16.0`.
* [ ] `vue-tsc` remains on `3.2.8`.
* [ ] All requested validation commands pass.
* [ ] The original optimization PRD section H is updated from assessment-only notes to execution record plus remaining decisions.

## Out of Scope

* Production dependency upgrades, including `axios`.
* `vue-tsc` compiler-tooling update.
* Node 25 runtime or typings migration.
* Any use of `npm audit fix --force`.
* Broad dependency upgrades beyond the five explicitly allowed packages.

## Technical Notes

* Current direct dependency state was confirmed with `npm ls --depth=0 --json`.
* Existing dirty files outside this task should be treated as unrelated user/WIP changes and left alone.
