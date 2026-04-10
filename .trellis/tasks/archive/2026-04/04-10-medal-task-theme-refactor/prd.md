# brainstorm: 粉丝牌任务拆分与主题重构

## Goal

Rework the Web UI around medal-driven workflows so medal data is fetched automatically and synchronized into keep-alive and double-reward management, while also restructuring the navigation and theme system to better match a desktop-style control panel.

## What I already know

* The current idea of "fetch medal list first, then manually tick rooms to sync into keep-alive tasks" is considered wrong by the user; the preferred direction is automatic fetch and synchronization into keep-alive tasks.
* The user wants Cookie management, keep-alive, and double-reward management split into separate items in the left navigation.
* The user wants the Web UI to support a light theme, a pure-black OLED dark theme, and automatic follow-system theme behavior.
* The medal-related UI should resemble a desktop client style with a detailed medal list, including fields such as streamer name, intimacy level, and intimacy progress/value.
* The double-reward feature should be managed on top of the medal list with per-item checkboxes controlling whether double-reward is enabled.
* Repo inspection shows the existing Electron renderer already has a desktop-style medal list table in `src/renderer/views/jobs/index.vue` with columns for streamer name, room id, medal level, medal rank, today intimacy, and total intimacy.
* Repo inspection shows the Docker Web UI already has a separate fan-status page and currently extends each medal item with double-card status in `src/docker/html.ts`.
* Repo inspection shows the current Docker Web UI still uses the older manual flow: fetch fans, tick selected rooms, then apply them only to keep-alive tasks.
* Repo inspection shows current Docker persistence keeps two independent task configs, `keepalive` and `doubleCard`, each storing its own `send` room map in `src/core/types.ts` and `src/docker/index.ts`.
* Latest clarification from the user: when the medal list changes (rooms added or removed), both keep-alive and double-card configurations should change accordingly; existing rooms must preserve prior allocation and checked state; newly added rooms should receive default allocation values and start unchecked.

## Assumptions (temporary)

* Existing medal-fetch capabilities and related task persistence already exist and are already wired into both Electron and Docker runtimes.
* The requested work will likely span frontend and backend/API layers.
* The initial MVP should prioritize a working medal-driven management flow and navigation split over broader visual redesign polish.
* The desktop Electron table in this repo is the primary UX reference for medal list presentation.

## Open Questions

* None currently. Ready for implementation after final confirmation.

## Requirements (evolving)

* Fetch the medal list automatically and use it as the source of truth for related task management.
* Present medal entries with desktop-like detail, including streamer identity and medal progress fields.
* Let users manage double-reward enablement per medal entry via checkbox state.
* A checked double-reward item means that room participates in double-card detection and in the eventual gift-sending candidate set for the double-card task.
* Double-reward selection must persist independently from keep-alive membership state.
* Double-card must keep its own independent allocation model and configuration instead of reusing keep-alive allocation.
* On first-time setup, all double-reward checkboxes default to disabled.
* When prior double-reward configuration exists, previously configured rooms must keep their existing enabled state, and newly appeared medal entries must default to disabled.
* When the medal list changes, both keep-alive and double-card configurations must reconcile against it.
* Existing keep-alive rooms must preserve their prior allocation values during medal-list reconciliation.
* Existing double-card rooms must preserve both their prior allocation values and checked-state values during medal-list reconciliation.
* Newly added rooms must receive keep-alive default allocation values and start unchecked in double-card during medal-list reconciliation.
* Removed medal rooms must be removed from the related keep-alive and double-card configurations during medal-list reconciliation.
* In keep-alive fixed-number mode, newly added medal rooms must default to allocation value `1`.
* In keep-alive percentage mode, newly added medal rooms must default to allocation value `1%`.
* Split Cookie, keep-alive, and double-reward into separate left-side navigation sections.
* Support light theme, dark theme, and follow-system behavior.
* The first pass should include the full theme-mode implementation rather than a placeholder toggle.

## Acceptance Criteria (evolving)

* [ ] Medal data is fetched automatically without requiring a manual import workflow.
* [ ] Keep-alive and double-card configurations reconcile automatically when the medal list changes.
* [ ] Double-reward can be enabled or disabled per medal entry from the medal-based UI.
* [ ] Existing keep-alive allocations remain unchanged for unchanged rooms after medal-list reconciliation.
* [ ] Existing double-card allocations and checked states remain unchanged for unchanged rooms after medal-list reconciliation.
* [ ] Newly discovered medals receive keep-alive default allocation values and start unchecked in double-card.
* [ ] Removed medals are removed from related task configurations.
* [ ] Navigation separates Cookie, keep-alive, and double-reward into distinct sections.
* [ ] Theme mode supports light, dark, and follow-system behavior.

## Definition of Done (team quality bar)

* Tests added or updated where appropriate
* Lint and typecheck pass
* Docs or notes updated if behavior changes
* Rollout and rollback implications considered for task synchronization behavior

## Out of Scope (explicit)

* Native desktop application development
* Non-medal-based task automation unrelated to keep-alive or double-reward
* Final visual polish decisions not required for MVP behavior
* Replacing the Electron renderer UX unless required for shared model alignment

## Technical Notes

* Task created from brainstorm flow on 2026-04-10.
* Current Electron navigation is still coarse (`首页` / `配置` / `关于我`) in `src/renderer/layout/index.vue`, so the requested left-nav split is a new information architecture rather than an existing shared pattern.
* `src/core/api.ts#getFansList` already returns the key medal fields needed for the detailed list: `name`, `roomId`, `level`, `rank`, `intimacy`, `today`.
* Docker backend currently exposes:
  * `/api/fans` for medal list
  * `/api/fans/status` for medal list plus double-card status
  * `/api/config` for saving `keepalive` and `doubleCard` job configs
* Current Docker Web UI is implemented as a single HTML string in `src/docker/html.ts`, so substantial navigation/theme refactor will be done within that file unless the implementation also introduces a more maintainable structure.

## Code-Spec Depth Check

* Target contract files to update:
  * `src/core/types.ts`
  * `src/docker/server.ts`
  * `src/docker/index.ts`
  * `src/docker/html.ts`
  * `config.example.json`
  * `README.md`
* Concrete contract to define before implementation:
  * Docker config gains UI preference state for theme mode.
  * Medal reconciliation becomes an explicit backend behavior for both `keepalive.send` and `doubleCard.send`.
  * Double-card checked state needs an explicit persisted representation instead of inferring everything from room existence alone.
* Validation and error matrix:
  * Missing cookie while requesting medal sync -> return `400` with Chinese error.
  * Medal fetch failure -> keep old config untouched, surface actionable error.
  * Invalid cron/model/save payload -> reject at route boundary as today.
  * Empty medal list -> synchronized configs become empty room sets without crashing.
* Good/Base/Bad cases:
  * Good: medal list adds one room, keepalive preserves old values and adds defaults, double-card preserves old checked rooms and leaves new room unchecked.
  * Base: medal list unchanged, saving should be idempotent.
  * Bad: medal list fetch fails, existing persisted config must remain unchanged.

## Relevant Specs

* `.trellis/spec/frontend/component-guidelines.md`: Route/view files should stay direct and readable, with local state kept near the page.
* `.trellis/spec/frontend/state-management.md`: Persisted remote/config state should be normalized after read, especially when the available fans list changes.
* `.trellis/spec/frontend/type-safety.md`: Shared cross-runtime types should stay in `src/core/types.ts` with explicit runtime validation.
* `.trellis/spec/frontend/quality-guidelines.md`: Avoid creating a third duplicate data-fetch variant and keep user-visible loading/error states intact.
* `.trellis/spec/backend/directory-structure.md`: Reusable medal/config synchronization logic should live in `src/core/` where possible, not inside route handlers.
* `.trellis/spec/backend/error-handling.md`: Fail in helpers, catch at HTTP/runtime boundaries, return lightweight JSON errors.
* `.trellis/spec/backend/logging-guidelines.md`: Keep logs simple and do not leak cookies or raw auth config.
* `.trellis/spec/backend/quality-guidelines.md`: Preserve config shape compatibility and validate inputs at boundaries.
* `.trellis/spec/guides/cross-layer-thinking-guide.md`: Define backend/frontend config and medal-sync contracts explicitly at the boundary.

## Code Patterns Found

* Medal-list normalization against current rooms: `src/renderer/views/config/index.vue`
* Shared medal scraping fields and ordering: `src/core/api.ts`
* Docker route boundary validation and simple JSON errors: `src/docker/server.ts`
* Docker config load/save plus scheduler restart wiring: `src/docker/index.ts`
* Docker medal-status table rendering and periodic reload: `src/docker/html.ts`

## Files to Modify

* `src/core/types.ts`: add persisted types for theme preference and double-card checked state.
* `src/core/`: add reusable medal-sync helpers to merge/prune room configs safely.
* `src/docker/index.ts`: apply medal-driven synchronization before saving/restarting tasks.
* `src/docker/server.ts`: expose or adapt routes needed for medal sync and UI preference persistence.
* `src/docker/html.ts`: rebuild navigation, medal-driven keepalive/double-card views, and theme switching.
* `config.example.json`: document the new persisted shape.
* `README.md`: update WebUI behavior and config semantics.

## Research Notes

### What similar tools do

* The existing Electron desktop client in this repo uses a medal list table as the main operational view instead of a checkbox-import helper.
* The current Docker Web UI already started moving in that direction by adding a dedicated fan-status page with medal rows and per-room double-card state, but configuration still happens through separate manual room editors.

### Constraints from our repo/project

* Keep-alive and double-card are persisted as separate job configs, each with its own room allocation map.
* Medal list data currently comes from live Douyu cookie-authenticated scraping; no local cache model exists yet.
* Theme switching does not exist yet in Docker Web UI, and the current CSS is a single dark visual system baked into `src/docker/html.ts`.
* User clarified that "OLED 黑" can be treated as the project's dark mode, not a separate additional dark variant.

### Feasible approaches here

**Approach A: Medal list as the shared source of truth** (Recommended)

* How it works:
  Keep-alive automatically mirrors the full fetched medal list, while double-card uses the same medal rows with persisted per-row enabled state. Cookie, keep-alive, and double-card move to separate left-nav pages.
* Pros:
  Best matches the user request and the desktop-table mental model; removes manual import drift for keep-alive; unifies medal presentation.
* Cons:
  Requires backend sync rules and careful migration from manual room editing.

**Approach B: Medal list as an assistive editor over existing task configs**

* How it works:
  Keep existing task configs as primary data, but replace manual import with a richer medal list editor that can batch-sync or reconcile into both tasks.
* Pros:
  Smaller backend change; safer for existing config model.
* Cons:
  Still leaves two sources of truth and preserves some conceptual complexity that the user is explicitly pushing against.

**Approach C: Keep current task editors and only add a better medal status page**

* How it works:
  Maintain manual room configuration, add detailed medal list display, and add theme/nav improvements only.
* Pros:
  Lowest implementation risk.
* Cons:
  Does not satisfy the user's correction that manual fetch-and-tick is the wrong model.

## Decision (ADR-lite)

**Context**: The old Web UI modeled medal data as a manual import helper for keep-alive configuration, but the desired product direction is medal-driven task management closer to the desktop client list view.

**Decision**: Use the medal list as the source of truth for task management. Both keep-alive and double-card configurations reconcile against medal-list changes. Double-card is managed on top of the medal list with per-entry enablement and still keeps an independent double-card task configuration and allocation model.

**Consequences**: Medal reconciliation logic must deterministically handle additions and removals for both tasks. Existing keep-alive allocations must be preserved for unchanged rooms. Existing double-card allocation and checked-state data must also be preserved for unchanged rooms. New medals must receive default keep-alive values and start disabled in double-card.

## Technical Approach

Introduce medal-driven synchronization into the Docker Web UI and backend config layer. Keep-alive room membership will be derived from the fetched medal list and merged into persisted config while preserving existing allocation values and assigning defaults to newly discovered medals. Double-card will use the same medal list presentation, but with an independent checked-state model and independent allocation settings for the checked rooms, preserving both values for unchanged rooms and pruning removed medals.

The Docker Web UI navigation will be split into separate sections for Cookie, Keepalive, Double Card, and medal-centric status/management. Theme support will be added as a first-class preference with light, dark, and follow-system modes. The dark theme corresponds to the user's requested OLED-black direction.
