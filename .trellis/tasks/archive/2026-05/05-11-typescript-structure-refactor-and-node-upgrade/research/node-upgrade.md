# Node upgrade research

## Summary

Upgrade the Docker/runtime baseline from Node 18 to Node 24 LTS. Do not target Node 26 for this production Docker image yet, because Node 26 is the current release line in May 2026 and is not scheduled to enter LTS until October 2026.

## Findings

- Node 18 is past end-of-life and should not remain the runtime baseline for a maintained Docker image.
- Node 24 is the active LTS line as of May 2026 and is the conservative production target.
- Node 26 is available as the current release line, but it is better suited for experimentation until its LTS transition.
- The project currently compiles to CommonJS with `target: ES2020`, uses Express 4, Axios, ws, cron, and has no native add-ons in `dependencies`, so the Node runtime upgrade should be low-risk.

## Recommended upgrade

- Docker builder image: `node:24-slim`
- Docker runtime image: `node:24-slim`
- `@types/node`: align to Node 24
- `tsconfig.docker.json`: keep CommonJS unless a separate ESM migration is explicitly scoped
- Avoid bundling or a package manager migration in the first pass

## Follow-up checks

- `npm install` after dependency changes
- `npm run type-check`
- `npm run build:docker`
- Run container smoke test if practical

## Sources

- Node.js release schedule: https://github.com/nodejs/Release
- Node.js official downloads: https://nodejs.org/en/download
- Official Node Docker image documentation: https://hub.docker.com/_/node
