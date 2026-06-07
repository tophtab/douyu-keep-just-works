# Optimize Docker workflow build speed

## Goal

Reduce unnecessary GitHub Actions Docker build time without changing the existing image release behavior.

## Requirements

* Keep the existing master branch, tag release, pull request, and manual workflow dispatch behavior.
* Shrink Docker build context so non-image files such as local metadata, workflow task files, screenshots, and docs do not affect Docker context upload or cache keys.
* Reduce duplicated dependency installation cost in the Dockerfile while preserving a production-only runtime image.
* Add workflow path filters so documentation-only or unrelated metadata changes do not trigger Docker image builds.

## Acceptance Criteria

* [x] Docker build context includes only files needed by the Dockerfile and build scripts.
* [x] Dockerfile still builds the web UI and Docker runtime successfully.
* [x] Runtime stage no longer runs a second network-based `npm ci` when it can derive production dependencies from the builder output.
* [x] Docker workflow still runs for source, package, Dockerfile, and workflow changes.
* [x] Docker workflow ignores docs-only changes on branch pushes and pull requests.

## Definition of Done

* Docker configuration is updated.
* GitHub workflow trigger filters are updated.
* Docker image build is verified locally if Docker is available.
* Relevant project quality checks are run where practical.

## Technical Approach

Use a strict `.dockerignore` allowlist matching current Dockerfile inputs. In the Dockerfile, install dependencies once in the builder stage, build the app, prune development and optional packages, then copy the pruned `node_modules` into the runtime stage. Add `paths` filters to `push` branch and `pull_request` triggers while keeping tag releases and manual dispatch unaffected.

## Decision (ADR-lite)

**Context**: The current Docker build already uses GitHub Actions cache, but the Dockerfile performs dependency installation in both builder and runtime stages. The repository also contains local workflow metadata and Playwright artifacts that are irrelevant to image builds.

**Decision**: Prefer configuration-level optimizations over changing application build output or release semantics.

**Consequences**: The Docker context allowlist is intentionally strict; future Docker build inputs must be added to `.dockerignore` explicitly.

## Out of Scope

* Changing image tags, release channels, Docker Hub credentials, or multi-architecture release strategy.
* Replacing npm or changing the package manager.
* Skipping lint/type-check validation in the workflow.

## Technical Notes

* Existing workflow: `.github/workflows/docker.yml`
* Existing Dockerfile: `Dockerfile`
* Build scripts: `package.json`
* TypeScript and Vite configs: `tsconfig.docker.json`, `tsconfig.webui.json`, `vite.config.ts`
