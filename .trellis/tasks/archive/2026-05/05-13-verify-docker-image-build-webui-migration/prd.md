# Verify Docker Image Build After WebUI Migration

## Goal

Verify that the Docker image builds successfully after the conservative Vue 3 + Vite + TypeScript WebUI migration, now that the local network is healthy again.

## What I Already Know

- The first-stage WebUI migration was completed in commit `4a80d70 feat: build Docker WebUI with Vue and Vite`.
- The migration keeps Express as the runtime server and serves Vite-built WebUI static assets from `build/docker/docker/webui/`.
- The legacy `src/docker/webui/app-*.js` behavior modules are still bundled by Vite as a transitional layer.
- The previous Docker image build attempt failed during in-container `npm ci` with local network `ECONNRESET`.
- The user reports the network is now normal and wants the Docker image build run before continuing more migration work.

## Assumptions

- This task is verification only unless the Docker build exposes a concrete repository issue.
- The image should be built locally only; do not push to Docker Hub.
- Use the existing Dockerfile and default build context.
- If the build succeeds, record the result and recommend the next migration step separately.

## Requirements

- Run a local Docker image build from the repository root.
- Confirm the Dockerfile can install builder dependencies, run `npm run build:docker`, install production runtime dependencies, and assemble the final image.
- Confirm Vue/Vite/TypeScript remain builder-time tooling and do not need to be installed in the runtime stage.
- Do not publish or tag a release image.

## Acceptance Criteria

- [x] `docker build` completes successfully from the repository root.
- [x] The build reaches the final runtime image stage.
- [x] Any failure is captured with the exact failing step and likely cause.
- [x] The working tree remains clean except for Trellis task bookkeeping.

## Definition of Done

- Docker build result is recorded in this task.
- If successful, recommend whether to continue with component/composable migration next.
- If failed, decide whether a code fix is needed or whether the failure is environmental.

## Out of Scope

- Pushing images to Docker Hub.
- Running a release workflow.
- Rewriting legacy WebUI modules into Vue components in this task.
- Changing Docker deployment defaults unless the build reveals a required fix.

## Technical Notes

- `Dockerfile` copies `package.json`, `package-lock.json`, `tsconfig.docker.json`, `tsconfig.webui.json`, and `vite.config.ts`, then runs `npm ci` and `npm run build:docker` in the builder stage.
- Runtime stage runs `npm ci --omit=dev --omit=optional`, then copies `/app/build/docker` to `/app/dist`.
- `package.json` scripts:
  - `build:webui`: `npm run type-check:webui && vite build`
  - `build:docker`: `rm -rf build/docker && npm run build:webui && tsc -p tsconfig.docker.json`
- Relevant specs:
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/guides/docker-webui-auth-contract.md`

## Verification Results

- Initial plain `docker build -t douyu-keep-just-works:webui-vite-verify .` still hit an environmental `ECONNRESET` during runtime-stage `npm ci`.
- Container npm registry probes succeeded under default Docker networking, host networking, and the host shell.
- `docker build --network=host -t douyu-keep-just-works:webui-vite-verify .` reached `npm run build:docker` and exposed a real builder-stage issue: Vite/Rolldown could not load `@rolldown/binding-linux-x64-gnu` because builder dependencies were installed with `--omit=optional`.
- Fixed `Dockerfile` so the builder stage keeps optional dependencies while the runtime stage still uses `--omit=dev --omit=optional`.
- Updated the Docker build specs to record that Vite/Rolldown native bindings are builder-time optional dependencies that must be installed in the builder stage.
- `docker build --no-cache --network=host -t douyu-keep-just-works:webui-vite-verify .` passed.
- Final local image:
  - Tag: `douyu-keep-just-works:webui-vite-verify`
  - Image ID: `sha256:29594581ea13f6ef86b2c8070313991d869be73b01a69c1cca653303c12da189`
  - Size: `85710526` bytes
- Runtime smoke test passed:
  - Container started on `127.0.0.1:51418`.
  - `/` returned HTTP 200 and Vite asset references.
  - `/api/auth/status` returned HTTP 200 with `{"authenticated":false}`.
  - Runtime dependency check confirmed no `node_modules/vite` or `node_modules/vue` directory and `express` is available.
