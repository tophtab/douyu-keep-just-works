# State Management

> How state is managed in this project.

---

## Overview

The frontend uses Vue refs and computed values. There is no Pinia, Vuex, React Query, SWR, or browser persistence layer. Server state is loaded from the Docker WebUI API and synchronized with legacy bridge events during the migration to Vue.

---

## State Categories

- Local form state: refs inside page composables or components, such as cookies, cron expressions, and enabled toggles.
- Shared app state: top-level composables in `App.vue`, such as auth, navigation, theme, toast, and overview.
- Server state: API responses loaded through `requestJson` and resource helpers.
- Legacy bridge state: compatibility state dispatched through `WEBUI_BRIDGE_EVENTS`.

`App.vue` is the composition root:

```typescript
const { activePageMeta, activeTab, selectTab, tabs } = usePageNavigation(bootstrap.pageRoutes)
const { authenticated, logout, password, submitLogin } = useAuthSession()
const overviewPage = useOverviewPage()
```

---

## When to Use Global State

There is no global store. Promote state upward only when multiple shell/page surfaces need it:

- auth session belongs in `useAuthSession` and is consumed by `App.vue`.
- theme belongs in `useThemeMode` because it touches document metadata and app controls.
- overview state belongs in `useOverviewPage` because toolbar refresh and overview page content share it.
- task-page specifics should stay in the task page composable.

---

## Server State

Use the API as the source of truth. After saves or task triggers, refresh the relevant resources through existing refresh callbacks.

Legacy resource state in `resources.ts` uses request tracking to avoid stale updates:

```typescript
interface LegacyResourceRequest {
  pending: Promise<unknown> | null
  requestSeq: number
}
```

When adding a new server resource, consider whether it must dispatch a bridge event for old modules or can remain Vue-only.

---

## Common Mistakes

- Do not add a global store for one page's local form state.
- Do not store API data only in legacy `window.DOUYU_KEEP_WEBUI_*` objects when Vue components need it.
- Do not update UI state optimistically without a catch path that reverts on failure.
- Do not bypass existing resource invalidation when task config changes affect fans, gift, or yuba status.
