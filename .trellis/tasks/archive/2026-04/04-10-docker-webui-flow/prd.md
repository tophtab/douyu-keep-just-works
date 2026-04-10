# brainstorm: improve docker webui flow

## Goal

Improve the Docker Web UI so it is more usable for day-to-day self-hosting. The current pain points already identified are: there is no overview/dashboard page, and cookie saving is coupled to full task configuration so users cannot save cookie credentials independently.

## What I already know

* The Docker app already has a working Web UI with three tabs: config, status, and logs.
* The Docker backend already supports config read/write, status, logs, manual triggers, and fan badge fetching.
* Auto-fetching the fans badge list is already implemented.
* Selecting fans from the fetched list and applying them to the keepalive task is already implemented.
* The user now wants a new Web UI page, placed after the homepage in navigation order, dedicated to fan badge list details.
* The desired presentation should reference the desktop jobs page and include fields such as room id, anchor name, intimacy, and related badge information.
* The user also wants an extra column for double-card state / multiplier.
* Current save flow sends one full config payload to `POST /api/config`.
* Server-side validation currently requires both a non-empty cookie and at least one of `keepalive` / `doubleCard`, which blocks cookie-only saving.
* Relevant files already inspected:
  * `src/docker/html.ts`
  * `src/docker/server.ts`
  * `src/docker/index.ts`
  * `src/core/api.ts`
  * `src/core/double-card.ts`
  * `src/renderer/views/jobs/index.vue`
  * `README.md`

## Assumptions (temporary)

* This task is focused on the Docker Web UI, not the Electron desktop UI.
* The user likely wants an MVP that improves information architecture and save flow without replacing the current inline HTML implementation with a separate frontend stack.
* The overview page should summarize existing runtime/config information rather than introduce a large new backend domain model.

## Open Questions

* None for MVP at the moment.

## Requirements (evolving)

* Add a clearer high-level Docker Web UI flow.
* Add an actual overview/dashboard page.
* Add a dedicated fan badge list page after the homepage in the Web UI navigation.
* Name that page `粉丝牌状态`.
* Automatically load the fan badge list page data and automatically fetch double-card state for every listed room.
* Move the main Web UI navigation to the left side instead of the current top horizontal navigation.
* Use a fixed left sidebar on desktop.
* Support saving cookie credentials without requiring task configuration to be complete.
* Reorganize the UI into a clearer step-by-step configuration flow.
* Use a hybrid save model:
  * Cookie has its own save action
  * Task settings remain grouped under one explicit save action
* Preserve existing features for fetching fans, selecting fans, viewing status, viewing logs, and manually triggering jobs.

## Acceptance Criteria (evolving)

* [ ] Users can save cookie credentials independently from keepalive/double-card task settings.
* [ ] Users can still fetch fan badge data after saving cookie only.
* [ ] The Web UI includes a true overview/dashboard view instead of only config/status/logs.
* [ ] The overview/dashboard prioritizes runtime status: config/task state, run state, and recent operational signal.
* [ ] The Web UI includes a dedicated fan badge list page modeled after the desktop jobs view.
* [ ] The new page is exposed in navigation as `粉丝牌状态`.
* [ ] The fan badge table includes at least room id, anchor name, intimacy-related fields, and double-card state.
* [ ] Opening the fan badge list page automatically loads the table and its double-card status without requiring a second manual refresh action.
* [ ] Main navigation is rendered on the left side of the page layout.
* [ ] Desktop navigation uses a fixed left sidebar instead of the current top strip.
* [ ] The configuration area follows a clearer step-based flow than the current single long page.
* [ ] Task settings are still saved through one explicit action rather than many fragmented per-section saves.
* [ ] Existing Docker task execution, logs, and status behavior remain intact.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Technical Approach

* Keep the current Docker Web UI as server-rendered inline HTML in `src/docker/html.ts`.
* Add a new overview/dashboard tab as the default landing page.
* Make the overview status-first:
  * task configured or not
  * task running or not
  * last run / next run
  * recent logs / quick action entry points
* Add a dedicated fan badge list page after the overview page, using desktop UI columns as the reference shape.
* Label that page `粉丝牌状态` in the navigation.
* Auto-load the fan badge table on that page and enrich each row with double-card state by checking every listed room.
* Restructure the shell layout so navigation lives on the left.
* Keep the sidebar fixed on desktop.
* Split backend save behavior so cookie persistence is independent from task configuration persistence.
* Keep task settings under one grouped save action to avoid fragmenting the form too much.
* Preserve existing fan-fetch and selected-fan apply behavior during the UI reorganization.

## Out of Scope (explicit)

* Rewriting the Docker Web UI into a separate SPA framework
* Reworking the Electron desktop UI
* Adding keepalive vs double-card target selection for selected fans in this MVP
* Broad auth/security redesign unless it becomes necessary for the selected MVP

## Decision (ADR-lite)

**Context**: The Docker Web UI already works, but the current information architecture and save flow are awkward. The user explicitly wants more than a minimal patch, but does not want to expand scope into broader assignment logic changes yet.

**Decision**: Use a medium-scope MVP:

* add a true overview/dashboard page
* decouple cookie saving from task configuration saving
* reorganize configuration into a clearer step-by-step flow
* use a hybrid save model: standalone cookie save, grouped task-config save
* make the overview status-first instead of setup-first
* add a desktop-inspired fan badge list page, including double-card state
* expose it as the `粉丝牌状态` page directly after the homepage
* auto-refresh the table data and double-card state when that page loads
* move navigation from the top strip to a left-side app shell
* use a fixed desktop sidebar layout

**Consequences**:

* More UI restructuring than a minimal patch
* Better usability for first-time setup and iterative editing
* Lower complexity than fully section-by-section saving
* The fan badge page becomes heavier because each visit may trigger per-room double-card checks
* The page shell needs another layout pass to support a sidebar navigation model
* Leaves fan-target assignment expansion for a later task

## Technical Notes

* Docker UI HTML/JS is generated from `src/docker/html.ts`.
* Docker API routes are defined in `src/docker/server.ts`.
* Runtime config loading and job control are in `src/docker/index.ts`.
* Cookie masking already exists for `/api/config`; `/api/config/raw` returns the real cookie.
* The recent Docker-focused commits are:
  * `d286437 feat: 添加 Docker WebUI 管理面板`
  * `942b5be docs: 更新 README 和 docker-compose 添加 WebUI 端口映射`
  * `3f0a287 fix: 配置文件缺失时不再崩溃退出，先启动 WebUI 等待配置`
  * `560a66d feat: 添加默认配置，无 config.json 时 WebUI 预填默认值`
  * `17df7e1 feat: WebUI 自动获取粉丝牌列表替代手动输入房间号`
  * `df90623 feat: WebUI 添加粉丝牌列表获取和勾选功能`

## Research Notes

### Relevant Specs

* `.trellis/spec/frontend/component-guidelines.md`: Docker Web UI still follows project frontend composition/style rules even though it is inline HTML.
* `.trellis/spec/frontend/state-management.md`: The page is a stateful UI with local fetch/update flow and explicit success/error states.
* `.trellis/spec/frontend/type-safety.md`: Shared config and task shapes come from `src/core/types.ts`.
* `.trellis/spec/backend/error-handling.md`: New API routes must preserve the existing lightweight JSON success/error contract.
* `.trellis/spec/backend/quality-guidelines.md`: Backend changes should keep runtime wiring thin and validate at boundaries.
* `.trellis/spec/guides/cross-layer-thinking-guide.md`: This change spans HTML UI, HTTP routes, config persistence, and scheduler behavior.

### Code Patterns Found

* Thin route handlers delegating through `AppContext`: `src/docker/server.ts`
* Runtime bootstrapping and config-driven scheduler startup: `src/docker/index.ts`
* Client-side fetch helpers embedded in inline HTML script: `src/docker/html.ts`

### Files To Modify

* `src/docker/html.ts`: add overview tab, reorganize config flow, split cookie save from task-config save
* `src/docker/server.ts`: add cookie-save route and overview data route or equivalent server support
* `src/docker/index.ts`: decouple config application, preserve config without cookie, and handle cookie-only save safely
* `src/renderer/views/jobs/index.vue`: desktop reference for the fan badge table columns
* `src/renderer/layout/index.vue`: desktop reference for the left-side navigation pattern

### Cross-Layer Contract

* Cookie save must no longer require keepalive/double-card task settings.
* Task-config save must preserve the already stored cookie on the server side.
* Overview data must expose status-oriented signals without requiring the page to infer everything from raw config text.
* Scheduler startup must not discard saved task config merely because cookie is temporarily empty.
* Fan badge table data comes from the existing Douyu fan-list fetch plus an added per-room double-card status check during fan-page loading.
* Mobile navigation behavior is explicitly out of scope for this task, even if a future mobile version may prefer bottom navigation.
