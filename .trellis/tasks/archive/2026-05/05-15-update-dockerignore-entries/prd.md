# update dockerignore entries

## Goal

Reduce Docker build context noise by adding safe ignore patterns for local-only metadata, editor settings, cache, logs, test runtime output, and environment files.

## What I Already Know

* The user asked to analyze `.dockerignore` and add additional entries.
* `Dockerfile` only copies `package.json`, `package-lock.json`, `tsconfig.docker.json`, `tsconfig.webui.json`, `vite.config.ts`, and `src/`.
* Existing `.dockerignore` already excludes `node_modules`, `build`, `dist`, `artifacts`, `config`, `.git`, `.trellis`, `.agents`, and `doc`.
* Local directories currently present but not ignored by Docker include `.claude`, `.codex`, and `.cursor`.

## Requirements

* Keep Docker build inputs intact.
* Add safe ignore entries for local AI/tooling metadata.
* Add safe ignore entries for editor metadata, logs, env files, coverage/cache output, and test runtime artifacts.
* Keep the change limited to `.dockerignore`.

## Acceptance Criteria

* [ ] `.dockerignore` contains the additional safe local-only ignore patterns.
* [ ] Docker build context rules still allow files explicitly copied by `Dockerfile`.
* [ ] Existing `.dockerignore` entries are preserved.

## Out of Scope

* Changing `Dockerfile` copy behavior.
* Changing `.gitignore`.
* Running a full Docker image build unless needed to verify syntax or behavior.

## Technical Notes

* Inspected `.dockerignore`, `.gitignore`, `Dockerfile`, `package.json`, repository file layout, and local ignored files.
* Current Dockerfile uses explicit `COPY` statements, so broad local metadata ignores are low risk.
