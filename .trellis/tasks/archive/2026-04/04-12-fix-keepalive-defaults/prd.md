# Fix keepalive task defaults

## Goal
Make Docker keepalive tasks use a default fixed quantity of `1`, and preserve user-configured task values when the task switch is turned off.

## Requirements
- Keepalive fixed-mode default values must initialize to `1` instead of `0`.
- Turning off the keepalive task must stop scheduling without discarding the saved user config.
- Existing persisted configs must remain backward compatible when read from disk.
- Docker WebUI task state must display enabled/disabled status based on the saved task toggle, not only on config presence.

## Acceptance Criteria
- [ ] New keepalive room entries default to fixed quantity `1`.
- [ ] Disabling keepalive from the Docker WebUI preserves the last saved cron/model/send config.
- [ ] Re-enabling keepalive uses the previously saved config instead of rebuilding from defaults.
- [ ] Docker config normalization and scheduling continue to work with old configs that do not yet contain an explicit enable flag.

## Technical Notes
- The change spans shared config normalization in `src/core/`, Docker runtime scheduling in `src/docker/index.ts`, Docker HTTP validation/summary in `src/docker/server.ts`, and Docker WebUI state handling in `src/docker/html.ts`.
- Use backward-compatible config normalization to treat missing enable flags on existing task configs as enabled.
