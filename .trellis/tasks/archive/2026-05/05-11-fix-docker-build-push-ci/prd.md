# Fix Docker Build & Push CI Failure

## Goal

Restore the `Docker Build & Push` GitHub Actions workflow by bringing dependency metadata back into a state that `npm ci --ignore-scripts` can install reproducibly.

## What I Already Know

* The user reported: `Docker Build & Push: Some jobs were not successful`.
* The latest failed workflow run is `25656327576` on `master`, created on 2026-05-11 at 07:26:14 UTC.
* The failed job is `validate`, step `Install dependencies`.
* `npm ci --ignore-scripts` fails because `package.json` and `package-lock.json` are out of sync.
* The workflow does not reach lint, type-check, Docker runtime build, Docker image build, or push steps.
* The previous Docker workflow runs were successful, so this should be a narrow dependency lockfile repair.

## Assumptions

* No dependency version policy change is intended in this task.
* The correct fix is to update the committed lockfile to match the current `package.json`, not to relax CI by replacing `npm ci`.

## Requirements

* Keep the workflow using reproducible `npm ci` installs.
* Update dependency metadata so `npm ci --ignore-scripts` succeeds locally and in GitHub Actions.
* Avoid unrelated source, workflow, or Dockerfile changes unless verification reveals another failure.

## Acceptance Criteria

* [x] `npm ci --ignore-scripts` succeeds from a clean lockfile-compatible state.
* [x] `npm run lint` succeeds.
* [x] `npm run type-check` succeeds.
* [x] `npm run build:docker` succeeds.
* [x] `docker build` can complete the Dockerfile install/build path, or any local environment limitation is documented.

## Definition of Done

* Lockfile/package metadata is consistent.
* Relevant validation commands have been run.
* Any remaining CI-only risk is called out.

## Out of Scope

* Changing Docker image publishing behavior.
* Changing application runtime behavior.
* Updating package versions beyond what is required to synchronize the lockfile.

## Technical Notes

* Workflow file: `.github/workflows/docker.yml`
* Docker build file: `Dockerfile`
* Dependency metadata: `package.json`, `package-lock.json`
* Relevant contract: `.trellis/spec/guides/docker-webui-auth-contract.md`
* First local Docker build attempt failed with an `ECONNRESET` during in-container npm install; immediate retry completed successfully and produced `douyu-keep-just-works:ci-fix`.
