# TypeScript Contract and AI Context Convergence Implementation Plan

## Preconditions

- The user has approved `prd.md`, `design.md`, and `implement.md`.
- Start the task only after the planning review gate.
- Before code edits, load `trellis-before-dev` and the routed backend/frontend specs.
- Keep `wip/ts-normalize-parameter-names-order@0a963e1` read-only; extract fixtures and lessons, not patches.
- Back up any real `config/config.json` before a manual migration check. The file must remain ignored and uncommitted.

## Phase 1: Lock the Reduced Contract

1. Add table-driven fixtures for legacy, canonical, and mixed-precedence config inputs.
2. Assert canonical key order at the top level and inside public nested objects.
3. Assert login Cookie precedence, `active -> enabled`, allocation migration, and double-card room migration.
4. Add cron cases:
   - missing/default keepalive uses `0 0 8 * * 3`;
   - exact old default `0 0 8 */7 * *` migrates to Wednesday;
   - other six-field values remain unchanged.
5. Preserve focused behavior tests from the stable baseline for gift counts, Cookie masking, task locks, and WebUI config round trips.

Validation:

```bash
node --test test/config-guardrails-contract.test.js
node --test test/gift-task-contract.test.js
node --test test/douyu-passport-contract.test.js
node --test test/server-route-guardrails-contract.test.js
```

Stop if any legacy sample has more than one reasonable canonical result.

## Phase 2: Canonical Types, Defaults, and Normalization

1. Define canonical config, allocation, and runtime gift job types in the existing core type owner.
2. Keep legacy input fields in a boundary-only input type.
3. Make `normalizeDockerConfig` the explicit, deterministic constructor for canonical config.
4. Update `DEFAULT_KEEPALIVE_CRON` to `0 0 8 * * 3` and special-case only the exact old default during migration.
5. Update `config.example.json` and default config construction with canonical order.
6. Keep all cron parsing, preview, and runtime scheduling on the existing six-field dialect.

Validation:

```bash
npm run type-check:docker
node --test test/config-guardrails-contract.test.js test/douyu-passport-contract.test.js
```

Rollback point: do not continue to runtime consumers until all migration fixtures pass.

## Phase 3: Allocation Intent and Runtime Jobs

1. Replace normal `model/send` consumers with discriminated `allocationMode/roomAllocations` inputs.
2. Keep weighted and fixed validation narrow; reject mixed `weight/count` entries.
3. Preserve `-1` as the only remainder sentinel and allow it in at most one fixed room.
4. Produce runtime `GiftSendJobs` containing `roomId`, selected `giftId`, and actual `count` only after allocation.
5. Replace the double-card room boolean map with `participatingRoomIds`; keep runtime card `active` state unchanged.
6. Update fan reconciliation and room counting without introducing a second allocation representation.

Validation:

```bash
npm run type-check:docker
node --test test/gift-task-contract.test.js test/config-guardrails-contract.test.js test/code-optimization-contract.test.js
```

Stop if the same stable input produces different room gift counts, excluding only the intended serialized shape change.

## Phase 4: Persistence, API, and Runtime Consumers

1. Parse disk input through the migration boundary and expose canonical config to runtime services.
2. Save canonical config only after complete validation succeeds.
3. Convert API partial updates to canonical patches before merging with current config.
4. Return canonical config from reads and mutation responses.
5. Update scheduler/task metadata/config-change detection to use task `enabled` while preserving runtime locks and actual `active` state.
6. Update local Cookie snapshot and credential recovery paths to use canonical `loginCookies`.
7. Limit options/dependency-object changes to signatures directly made ambiguous by these new grouped values.

Validation:

```bash
npm run type-check:docker
node --test test/server-route-guardrails-contract.test.js test/douyu-passport-contract.test.js test/config-guardrails-contract.test.js
```

Rollback point: persistence and config API output must move together; do not leave a mixed write/read contract.

## Phase 5: WebUI Canonical Round Trip

1. Read canonical `loginCookies`, task `enabled`, allocation mode, and room allocations.
2. Save canonical payloads and apply the backend's authoritative canonical response.
3. Remove normal-path legacy config fallbacks from WebUI state.
4. Keep current Vue components, page order, labels, refresh semantics, and local Cookie ref names.
5. Update the keepalive default shown in the WebUI to `0 0 8 * * 3`.
6. Adjust Cookie diagnostics only where the backend public contract changed; do not redesign the page.

Validation:

```bash
npm run type-check:webui
npm run build:webui
node --test test/server-route-guardrails-contract.test.js test/code-optimization-contract.test.js
```

Stop if the WebUI needs a legacy fallback to initialize from the canonical backend response.

## Phase 6: Remove Legacy Normal Paths and Verify Context Scope

1. Search legacy names and classify every remaining occurrence as boundary input, migration fixture, upgrade documentation, or defect.
2. Remove WIP-inspired signature changes that are unrelated to the canonical contract.
3. Verify representative maintenance scenarios have one obvious owner and a bounded consumer list:
   - changing a task default;
   - adding an allocation validation rule;
   - adding a Cookie diagnostic flag.
4. Update README/config migration notes and relevant backend/frontend specs.
5. Manually inspect one migrated old config, one canonical saved config, one config API response, and each allocation mode.

Searches:

```bash
rg -n "manualCookies|manualPassport|cookieCloudActive|missingYubaKeys|\bmodel\b|\bsendConfig\b|\bsendArgs\b" src config.example.json
rg -n "\bactive\b" src/core src/docker --glob '*.ts' --glob '*.vue'
rg -n "0 0 8 \\*/7 \\* \\*|0 0 8 \\* \\* 3" src test config.example.json README.md
```

Full quality gate:

```bash
npm run lint
npm run type-check
npm run test:contracts
npm run build:docker
git diff --check
```

## Risk Areas

- `src/core/types.ts`
- `src/core/task-defaults.ts`
- `src/core/config-normalization.ts`
- `src/core/gift.ts`
- `src/core/gift-task.ts`
- `src/core/job-gift-utils.ts`
- `src/docker/config-store.ts`
- `src/docker/config-validation.ts`
- `src/docker/server-config-routes.ts`
- `src/docker/runtime-cookie-*.ts`
- `src/docker/runtime-scheduler.ts`
- `src/docker/task-metadata.ts`
- `src/docker/webui/resource-config.ts`
- `src/docker/webui/cookie-source-*.ts`
- `src/docker/webui/allocation-task.ts`
- task WebUI modules
- config, gift, Passport, and server route contract tests

## Completion Gate

- All PRD acceptance criteria have test or explicit manual evidence.
- Legacy fields exist only at the migration boundary, in fixtures, or in upgrade documentation.
- The six-field cron dialect remains supported; only the keepalive default semantics change.
- The WebUI and backend round-trip one canonical config shape.
- No repository-wide mechanical cleanup was added back into scope.
- `trellis-check` passes before spec updates, commit, and archive.

