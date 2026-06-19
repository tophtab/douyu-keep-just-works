# State Management

> Everyday state ownership and resource patterns for the Docker WebUI.

---

## Overview

The frontend uses Vue refs and computed values. There is no Pinia, Vuex, React
Query, SWR, or browser persistence layer. Server state is loaded from the Docker
WebUI API through Vue-owned resource helpers.

Read [Frontend Contracts](./contracts.md) for high-risk scenario contracts such
as theme bootstrap, resource error feedback, force refresh, config-save
responses, CookieCloud sync/check, and Passport QR polling.

---

## State Categories

- Local form state: refs inside page composables or components, such as cookies,
  cron expressions, and enabled toggles.
- Shared app state: top-level composables in `App.vue`, such as auth,
  navigation, theme, toast, and overview.
- Server state: API responses loaded through `requestJson` and resource helpers.
- Shared resource state: `resource-state.ts` owns only top-level
  overview/log/protected-data refresh orchestration.
- Focused resource owners: `resource-config.ts` owns raw/default config,
  `resource-fans.ts` owns fans/gift resources, `resource-yuba.ts` owns Yuba
  status, `resource-request.ts` owns request coalescing, and `logs-resource.ts`
  owns the logs page composable and auto-refresh timer.

`App.vue` is the composition root:

```typescript
const { activePageMeta, activeTab, selectTab, tabs } = usePageNavigation(bootstrap.pageRoutes)
const { authenticated, logout, password, submitLogin } = useAuthSession({ clearProtectedState, loadProtectedData })
const overviewPage = useOverviewPage(activeTab)
```

---

## When To Promote State

There is no global store. Promote state upward only when multiple shell/page
surfaces need it:

- auth session belongs in `useAuthSession` and is consumed by `App.vue`.
- theme belongs in `useThemeMode` because it touches document metadata and app
  controls.
- overview state and top-level refresh orchestration belong in
  `resource-state.ts` because toolbar refresh and overview page content share
  it.
- raw config, fans/gift, and Yuba state live in the focused `resource-*`
  modules. Page modules import these direct owners instead of relying on
  compatibility re-exports from `resource-state.ts`.
- task-page specifics stay in the task page composable.

---

## Server State

Use the API as the source of truth. After saves or task triggers, refresh the
relevant resources through existing refresh callbacks.

Resource state uses request tracking from `resource-request.ts` to avoid
duplicate in-flight requests and stale updates:

```typescript
interface ResourceRequest {
  pending: Promise<unknown> | null
  requestSeq: number
}
```

Shared resource loaders should use `runTrackedResourceRequest` for pending
reuse, sequence increments, and stale response guards. Concrete resource modules
still own their refs, loading flags, error refs, toast copy, and response
mapping.

Do not create a broad generic resource framework unless several focused
resource modules immediately need the same higher-level behavior. Abstract the
request lifecycle, not endpoint-specific state transitions.

When adding a new server resource, keep the API call in a Vue-owned composable
or shared resource helper. If the resource is shared across pages, create or
extend a focused `resource-*` module and import that owner directly from page
modules. Do not introduce `window.DOUYU_KEEP_WEBUI_*` bridge state.

### Protected Shell Mounting

Protected WebUI pages must not mount before authentication succeeds. Use
`v-if="authenticated"` for the authenticated shell, not `v-show`, because hidden
Vue components still run setup/watch logic and can issue protected API requests
before the session is ready.

When a protected helper can be called before authentication due to future
composition changes, unauthorized responses should be ignored or treated as
session state, not persisted as field validation errors.

---

## Common Mistakes

- Do not add a global store for one page's local form state.
- Do not store API data in `window.DOUYU_KEEP_WEBUI_*` globals.
- Do not update UI state optimistically without a catch path that reverts on
  failure.
- Do not bypass existing resource invalidation when task config changes affect
  fans, gift, or Yuba status.
- Do not put every new shared resource back into `resource-state.ts`; keep
  ownership focused and import concrete resource owners directly.
