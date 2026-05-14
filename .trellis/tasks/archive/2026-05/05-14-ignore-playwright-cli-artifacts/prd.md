# Ignore Playwright CLI artifacts

## Goal

Keep Playwright CLI runtime artifacts out of git because they are local logs and page snapshots, not source files.

## What I already know

* `.playwright-cli/` is currently untracked.
* The directory contains generated console logs and page snapshot YAML.
* `.gitignore` does not currently include `.playwright-cli/`.

## Requirements

* Add `.playwright-cli/` to `.gitignore`.
* Do not change project source code.

## Acceptance Criteria

* [x] `git status --short --ignored .playwright-cli .gitignore` shows `.playwright-cli/` as ignored.

## Out of Scope

* Deleting the existing local `.playwright-cli/` directory.
* Changing Playwright or application behavior.

## Technical Notes

* Relevant file: `.gitignore`.
