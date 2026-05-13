# State Management

> How state is managed in this project.

---

## Overview

Docker WebUI state is currently split between:

- Vue-local state in `src/docker/webui-src/`
- Transitional legacy browser state under `src/docker/webui/app-state.js`
- Persisted configuration through Docker HTTP APIs

There is no dedicated server-state library such as Vue Query, and Pinia is not part of the current Docker WebUI stack.

## State Categories

- Local UI state: form fields, loading flags, dialogs, validation messages, cron previews.
- Shared page state during the transition: existing `DOUYU_KEEP_WEBUI_*` modules under `src/docker/webui/`.
- Persisted state: Docker config read/written through `/api/config`, `/api/cookie-source/*`, and related Express routes.

## When To Add Global State

Add a global store only when:

- multiple Vue components need the same mutable state,
- route/page changes should preserve background progress,
- or duplicated fetch/update logic appears in several components.

Until then, prefer component state plus small helper modules.

## Server And Persistence State

- Fetch Docker runtime data through the existing Express JSON APIs.
- Do not call Douyu directly from Vue components when the Docker backend already owns that boundary.
- Preserve backend cache/coalescing semantics; the browser should not add cooldowns that suppress needed local API refreshes.

## Common Mistakes

- Do not introduce Pinia before there is shared Vue-owned state.
- Do not duplicate the legacy `app-state.js` model into Vue without a migration plan.
- Do not silently convert failed API requests into valid empty UI state.

## Scenario: Vue-Owned Transitional Navigation

### 1. Scope / Trigger

- Trigger: Moving a Docker WebUI behavior slice from `src/docker/webui/*.js` into Vue while the legacy modules still own data fetching/actions.
- Scope: Navigation tabs, active page visibility, page title/subtitle, browser history, and legacy lazy-load notification.

### 2. Signatures

```typescript
export function usePageNavigation(pageRoutes: Partial<Record<WebUiPageTab, string>>): {
  activePageMeta: ComputedRef<WebUiPageMeta>
  activeTab: Ref<WebUiPageTab>
  handleTabKeydown: (event: KeyboardEvent) => void
  selectTab: (tab: WebUiPageTab) => void
  tabs: WebUiPageMeta[]
}
```

```typescript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:navigation', {
  detail: { tab, skipLazyLoad },
}))
```

### 3. Contracts

- Vue owns the visible navigation DOM state: active tab class, `aria-selected`, `tabindex`, page `hidden`, page `aria-hidden`, and page title/subtitle.
- Vue syncs browser history from `DOCKER_WEBUI_PAGE_ROUTES` bootstrap data and listens to `popstate`.
- Legacy modules may listen for `douyu-keep-webui:navigation` to update `state.activeTab`, run page renderers, and trigger existing lazy loads.
- Legacy modules must not directly mutate the same tab/page/title DOM once Vue owns that surface.
- Legacy-generated `data-action="tab"` buttons should be bridged back into Vue navigation instead of handled by the legacy action dispatcher.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Unknown tab key | Fall back to `overview` |
| Unknown path | Resolve to `overview` |
| History API throws | Keep UI state usable and skip path mutation |
| User is unauthenticated | Legacy listener records `state.activeTab` but does not load protected page data |
| Legacy page renders a `data-action="tab"` button | Vue handles the click and notifies legacy through the navigation event |

### 5. Good/Base/Bad Cases

- Good: Vue updates `activeTab`, changes page visibility, pushes the new route, then dispatches `douyu-keep-webui:navigation`.
- Base: Legacy receives the navigation event and refreshes only data/render surfaces that still belong to legacy modules.
- Bad: Legacy click handlers call `querySelectorAll('.tab-btn')`, toggle `.page.hidden`, or rewrite `#page-title` after Vue owns navigation.

### 6. Tests Required

- Contract tests should assert that Vue navigation code exists and listens for legacy `data-action="tab"` bridge clicks.
- Contract tests should assert that legacy `app.js` no longer mutates `.tab-btn`, `.page`, `#page-title`, or `#page-subtitle` for the migrated surface.
- Run `npm run lint`, `npm run type-check`, and `npm test` after navigation changes.

### 7. Wrong vs Correct

#### Wrong

```javascript
document.querySelectorAll('.tab-btn').forEach(function (button) {
  button.classList.toggle('active', button.getAttribute('data-tab') === nextTab);
});
byId('page-title').textContent = PAGE_META[nextTab].title;
```

#### Correct

```vue
<button :class="{ active: activeTab === tab.key }" @click="selectTab(tab.key)">
  {{ tab.label }}
</button>
```
