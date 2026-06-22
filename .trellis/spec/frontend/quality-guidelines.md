# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend work must preserve the Docker WebUI build and the Vue-only runtime boundary. Use Vite, Vue 3, TypeScript, global CSS under `styles/`, and contract tests for architecture guarantees.

---

## Forbidden Patterns

- Do not reintroduce pre-Vite static WebUI source copying.
- Do not add `data-action` imperative handlers for Vue-owned actions.
- Do not add `installLegacy*Bridge`, `startLegacyApp`, or `window.DOUYU_KEEP_WEBUI_*` compatibility globals. `DOUYU_KEEP_WEBUI_BOOTSTRAP` in `index.html` is the only allowed WebUI bootstrap global.
- Do not add a new state-management library for local page state.
- Do not put secrets, raw cookies, or WebUI passwords into visible text, logs, or test fixtures.
- Do not put real account/runtime data into README images, screenshots, visual fixtures, or demo assets. Use clearly fictional sample streamer names, room IDs, gift rows, counts, logs, and account-related values.
- Do not make visual changes without checking responsive behavior when the task touches layout.

---

## Required Patterns

### Vue-Only Runtime Contract

Vue owns the WebUI lifecycle. Runtime responsibilities that span pages belong in `App.vue`, top-level composables, or `resource-state.ts`, not in a parallel imperative app.

When moving or adding runtime behavior:

* Keep `src/docker/webui/main.ts` limited to CSS imports and `createApp(App).mount('#app')`.
* Keep protected-data loading, top-level refresh, active-tab lazy loading, and request coalescing in Vue-owned modules.
* Update `test/project-maintenance-contract.test.js` when moving core WebUI components, resource ownership, or build files.
* Keep user-facing text and API calls unchanged unless the task explicitly includes behavior changes.

Wrong:

```typescript
installLegacyEventBridge()
startLegacyApp()
```

Correct:

```typescript
const overviewPage = useOverviewPage(activeTab)
watch([authenticated, activeTab], ([nextAuthenticated, nextTab]) => {
  if (nextAuthenticated) {
    void loadActiveTabData(nextTab)
  }
})
```

### Build Contract

The expected frontend build path is:

```bash
npm run type-check:webui
npm run build:webui
npm run build:docker
```

`build:docker` must include `build:webui`, and WebUI assets must be served from Vite output.

### Accessibility Contract

Preserve existing accessible patterns: tabpanels, live toast region, labeled inputs, alert role for login errors, and keyboard navigation in the sidebar.

---

## Testing Requirements

- Run `npm run lint` and `npm run type-check:webui` for frontend code changes.
- Run `npm run build:webui` or `npm run build:docker` when changing Vite, CSS imports, index.html, or component structure.
- Update `test/project-maintenance-contract.test.js` when adding, deleting, or moving core WebUI components, resource owners, runtime contracts, or build files.
- Include screenshots for user-visible layout changes before opening a PR, per `CONTRIBUTING.md`.

---

## Code Review Checklist

- Does the change keep Vue-owned UI declarative?
- Are composables cleaning up listeners?
- Are server responses narrowed from `unknown` before use?
- Are cross-page resource responsibilities owned by Vue modules and covered by tests?
- Does layout still fit at mobile and desktop widths?
- Does the Docker WebUI still build through Vite?
