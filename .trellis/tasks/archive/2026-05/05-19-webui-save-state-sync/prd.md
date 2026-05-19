# PRD: WebUI Save State Synchronization

## Context

This is a retroactive Trellis task record for work completed in commits `14e30d0` and `485f62f`.

The WebUI task configuration save flow persisted changes on the backend, but the frontend could keep rendering stale task configuration until the user manually refreshed the page. The stale display came from old managed fans state taking precedence over the newly loaded raw config.

The session also updated the keepalive task default cron from every 6 days to every 7 days and committed Trellis 0.5.17 template skill updates that were already present in the working tree.

## Goals

- Apply the authoritative `/api/config` save response back into WebUI shared state immediately after task saves.
- Ensure fans-backed task pages update both `rawConfig` and managed `{ config, fans }` state from the save result.
- Preserve existing refresh behavior for overview, logs, fans, and yuba-derived surfaces.
- Change the default keepalive cron from every 6 days to every 7 days.
- Add regression coverage for the save-response state contract.
- Capture the config-save response contract in the frontend state-management spec.
- Commit tracked Trellis 0.5.17 template updates that belonged with the local Trellis update.

## Non-Goals

- No visual redesign.
- No API route shape change beyond consuming the existing save response on the frontend.
- No migration of existing user config values.
- No forced commit of `.claude/` generated files because that path is ignored by project git rules.

## Acceptance Criteria

- Saving or disabling a task consumes `SaveTaskConfigResult` from `POST /api/config`.
- Fans-backed task surfaces (`keepalive`, `double-card`, `expiring-gift`) apply returned `config` and `fans` before refreshing derived data.
- Non-fans task saves can update `rawConfig` without clearing unrelated managed fans lists.
- `managed.config` no longer preserves an older task config after a successful save response.
- `DEFAULT_KEEPALIVE_CRON` is `0 0 8 */7 * *`.
- Contract tests assert the save-response state synchronization pattern.
- Frontend state-management spec documents the `/api/config` save response contract.
- Quality checks pass: `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm run build:webui`, and `npm run build:docker`.

## Completed Work

- `14e30d0 fix: sync saved webui task state`
- `485f62f chore: update trellis templates`
- `4f62d3a chore: record journal`

## Notes

The original injected task pointer referenced `.trellis/tasks/05-15-webui-resource-state-consolidation`, but that directory no longer existed. This task records the completed work under today's task directory so the Trellis task history is complete.
