# Contributing

Thanks for taking the time to improve this project. The maintained runtime is
the Docker WebUI, so contributions should keep the Docker deployment path
working first.

## Local Setup

Requirements:

- Node.js 24
- npm
- Docker, when validating image builds or Compose behavior

Install dependencies:

```bash
npm ci
```

Run the main quality checks:

```bash
npm run lint
npm run type-check
npm run build:docker
npm test
```

`npm test` currently runs the lightweight contract tests and then the Docker
build, including the Vite-built Docker WebUI assets. There is no full automated
runtime test suite yet.

## Docker-First Development

- Shared Douyu logic belongs in `src/core/`.
- Docker WebUI, Express routes, scheduler wiring, config file IO, and logs
  belong in `src/docker/`.
- Docker WebUI source lives in `src/docker/webui-src/` and is built by Vite
  into `build/docker/docker/webui/`; the existing `src/docker/webui/*.js`
  modules are the transitional browser behavior layer bundled by Vite.
- The Docker image must continue to build with `npm run build:docker`.
- Do not add Electron, Yarn desktop release, or renderer packaging work unless
  desktop support is explicitly restored.

## Pull Requests

Before opening a pull request:

- Keep the change focused and explain the user-visible impact.
- Run lint, type-check, and build/test checks.
- Update README, CHANGELOG, or examples when behavior changes.
- Call out any config shape or migration impact.
- Include WebUI screenshots for visual changes.

Do not create release commits, git tags, GitHub releases, or publish Docker
images from a normal contribution branch.

## Release Process

Maintainers should use the standard `npm version <version>` release flow so
package metadata, lockfile metadata, the release commit, and the git tag stay in
sync.

Before running `npm version`, update `CHANGELOG.md` with the dated release
notes and commit any changelog or release-prep changes that should be part of
the release. For a changelog-only prep commit:

```bash
git add CHANGELOG.md
git commit -m "chore: prepare release <version>"
```

Confirm the working tree is clean, then run the local release checks. Do not
use `npm version --force`; if npm reports a dirty working tree, stop and commit
or stash the pending changes first.

```bash
git status --short
npm run lint
npm run type-check
npm run build:docker
npm test
```

Create the package metadata changes, release commit, and tag from that clean
tree:

```bash
npm version <version> -m "chore: release %s"
```

After npm creates the release commit and tag, push the branch and tag
separately:

```bash
git push origin master
git push origin v<version>
```

The release tag must use `vX.Y.Z` or `VX.Y.Z`. Pushing the tag triggers the
Docker release workflow, which publishes the version tag and `latest`.

## Reporting Bugs

For login, cookie, CookieCloud, or task failures, include:

- Docker image tag
- Deployment method, such as Docker Compose or another container platform
- Sanitized logs
- Which task failed
- Whether manual cookies or CookieCloud is used
- Relevant cron/config shape with secrets removed

Never paste Douyu cookies, CookieCloud passwords, WebUI passwords, or a raw
`config.json` file into a public issue.

## Requesting Features

Describe the problem first, then the behavior you want. For Docker or WebUI
changes, include the expected deployment or screen flow.
