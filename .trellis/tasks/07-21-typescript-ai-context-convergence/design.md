# TypeScript Contract and AI Context Convergence Design

## 1. Design Goals

1. Keep TypeScript as the shared language across the backend and Vue WebUI.
2. Give each public concept one canonical shape after the input boundary.
3. Reduce misleading names and positional ambiguity only where they create a concrete misuse risk.
4. Keep serialized ordering stable for config review, snapshots, API responses, and AI-assisted maintenance.
5. Preserve runtime behavior, user-facing interactions, six-field cron syntax, and existing deployment paths.
6. Avoid a permanent compatibility layer. Legacy shapes exist only while parsing disk or API input.

This is an atomic public-contract migration. Splitting the final contract across independently released child tasks would leave the backend, persistence, and WebUI speaking different shapes. The implementation is therefore phased inside one task, with a green validation gate at each stable boundary.

## 2. Scope Reduction From the Preserved WIP

The preserved WIP is evidence, not an implementation base. Reuse its migration fixtures and domain decisions, but do not cherry-pick the commit.

Retained:

- canonical config naming and ordering;
- `enabled` for configured switches and `active` for runtime state;
- login Cookie grouping;
- allocation intent separated from runtime gift jobs;
- one-way legacy config migration;
- stable API/persistence/WebUI round trips;
- focused options/dependency objects only when required by a changed call path.

Removed:

- repository-wide function signature inventory;
- mechanical import, local-variable, or internal-object ordering;
- unrelated toast, navigation, loader, and constructor cleanup;
- Linux five-field cron migration;
- broad module movement or a new configuration framework.

## 3. Canonical Configuration

The canonical serialized order is:

```json
{
  "loginCookies": {
    "passport": "",
    "main": "",
    "yuba": ""
  },
  "cookieCloud": {
    "enabled": false,
    "endpoint": "",
    "uuid": "",
    "password": "",
    "cron": "0 5 0 * * *",
    "cryptoType": "legacy"
  },
  "ui": {
    "themeMode": "system"
  },
  "collectGift": {
    "enabled": true,
    "cron": "0 10 3,5 * * *"
  },
  "keepalive": {
    "enabled": true,
    "cron": "0 0 8 * * 3",
    "allocationMode": "fixed",
    "roomAllocations": {
      "123456": { "count": -1 }
    }
  },
  "doubleCard": {
    "enabled": false,
    "cron": "0 20 17,20,22,23 * * *",
    "giftScope": "glowStick",
    "participatingRoomIds": [123456],
    "allocationMode": "weighted",
    "roomAllocations": {
      "123456": { "weight": 50 }
    }
  },
  "expiringGift": {
    "enabled": false,
    "cron": "0 45 23 * * *",
    "thresholdHours": 24,
    "allocationMode": "weighted",
    "roomAllocations": {
      "123456": { "weight": 50 }
    }
  },
  "yubaCheckIn": {
    "enabled": false,
    "cron": "0 23 0 * * *",
    "mode": "followed"
  }
}
```

Ordering rules apply only to public serialized objects:

- top level: credentials, CookieCloud, UI, then task order;
- login Cookies: Passport, main, Yuba;
- scheduled task: `enabled`, `cron`, task-specific conditions, allocation mode, allocations;
- internal objects follow construction and data-flow needs rather than visual symmetry.

## 4. Type Boundaries

`DockerConfig` represents canonical state only. A separate boundary input type accepts legacy fields from disk and API requests. Legacy fields must not be visible to the scheduler, runtime services, task runners, or normal WebUI state.

Core shapes:

```ts
interface LoginCookiesConfig {
  passport: string
  main: string
  yuba: string
}

interface ScheduledTaskConfig {
  enabled: boolean
  cron: string
}

interface WeightedAllocationConfig {
  allocationMode: 'weighted'
  roomAllocations: Record<string, { weight: number }>
}

interface FixedAllocationConfig {
  allocationMode: 'fixed'
  roomAllocations: Record<string, { count: number }>
}

interface GiftSendJob {
  roomId: number
  giftId: number
  count: number
}
```

The room ID is the allocation map key. Persisted allocation entries do not repeat `roomId`, persist a fixed `giftId`, or store runtime `count` results. Fixed allocation continues to support `-1` as "all remaining", with at most one such entry.

`doubleCard.participatingRoomIds` replaces the old room boolean map named `enabled`, avoiding a collision with the task switch. Runtime `DoubleCardInfo.active` is unchanged.

## 5. Migration Boundary

`normalizeDockerConfig(input)` is the single legacy-to-canonical constructor. It selects fields explicitly and returns keys in canonical order.

| Canonical field | Legacy input | Precedence |
| --- | --- | --- |
| `loginCookies.passport` | `manualPassport.cookie` | canonical value when defined, then legacy, then empty |
| `loginCookies.main` | `manualCookies.main`, top-level `cookie` | canonical, manual main, top-level cookie |
| `loginCookies.yuba` | `manualCookies.yuba` | canonical, legacy, empty |
| `cookieCloud.enabled` | `cookieCloud.active` | canonical boolean, legacy boolean, default |
| task `enabled` | task `active` | canonical boolean, legacy boolean, existing default semantics |
| `allocationMode` | `model` | canonical; otherwise `1 -> weighted`, `2 -> fixed` |
| weighted allocations | `send.*.weight` | only for weighted mode |
| fixed allocations | `send.*.number` | only for fixed mode |
| `participatingRoomIds` | old `doubleCard.enabled` map | canonical array; otherwise truthy legacy room IDs |

Legacy `send.*.roomId`, `send.*.giftId`, and runtime `send.*.count` are discarded after migration.

Cron remains the existing six-field dialect. Migration has one special case:

```text
0 0 8 */7 * *  ->  0 0 8 * * 3
```

This special case applies only when the stored keepalive cron exactly equals the old default. All other valid six-field user expressions are preserved byte-for-byte after trimming.

## 6. Ownership and Data Flow

```text
disk/API legacy or canonical input
        |
        v
normalizeDockerConfig (single migration owner)
        |
        v
canonical DockerConfig
   |         |          |
   v         v          v
runtime   API output   persistence
   |
   v
allocation intent -> runtime GiftSendJobs -> Douyu calls
```

Primary ownership remains narrow and explicit:

| Concern | Owner |
| --- | --- |
| Canonical types | `src/core/types.ts` |
| Default values and task order | `src/core/task-defaults.ts` |
| Legacy migration and canonical construction | `src/core/config-normalization.ts` |
| Disk load/save and canonical patches | `src/docker/config-store.ts` |
| API validation and responses | `src/docker/config-validation.ts`, config routes |
| Task metadata and switch semantics | `src/docker/task-metadata.ts` |
| Allocation algorithms and runtime jobs | `src/core/gift.ts`, job helpers |
| WebUI adaptation | existing task and Cookie resource modules |

Do not add a generic repository, schema registry, event bus, or service layer. A new helper is justified only when it removes repeated non-trivial migration or construction logic from at least three consumers.

## 7. API and WebUI Contract

- Config reads return canonical config only.
- Config writes may accept current legacy fields at the backend boundary but return canonical config.
- Successful disk writes contain canonical keys only.
- The WebUI reads and writes canonical config only; it has no legacy fallback in normal state.
- Existing local refs may keep clear runtime names such as `passportCookie`, `mainCookie`, and `yubaCookie`.
- Existing layout, Chinese copy, resource refresh behavior, and save-response handling remain unchanged.

Cookie diagnostics are changed only as needed to remove misleading names, duplicated fields, or unstable public order. Do not redesign the entire diagnostics surface as a side effect. Raw Cookie values remain forbidden.

## 8. AI Context Guardrails

For every proposed edit, record its owning contract and direct consumers. Reject changes that:

- require reading unrelated navigation, toast, or resource modules;
- introduce a second normal representation of the same configuration;
- keep legacy fallback branches outside disk/API parsing;
- create interfaces with only one implementation and no test seam;
- rename clear internal values only to match JSON order;
- move files without reducing the number of owners needed for a typical change.

The final review uses three representative changes: changing a task default, adding one allocation validation rule, and adding one Cookie diagnostic flag. Each should have one obvious owner and a bounded consumer list.

## 9. Rollout and Rollback

The migration is one-way after a successful write. Before upgrade, users must back up `config/config.json`. Rolling back the application requires restoring the pre-upgrade config because older versions do not understand the canonical shape.

Implementation stop points:

1. Migration fixtures must produce a unique expected canonical config before consumers change.
2. Allocation results must match existing behavior before runtime call sites change.
3. Backend config responses and WebUI save payloads must agree before the new contract is considered releasable.
4. If any phase requires restoring a legacy field to normal runtime state, stop and correct the boundary instead.

