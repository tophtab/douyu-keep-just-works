# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend work must preserve the Docker WebUI build and the current Vue migration boundary. Use Vite, Vue 3, TypeScript, global CSS under `styles/`, and contract tests for architecture guarantees.

---

## Forbidden Patterns

- Do not reintroduce pre-Vite static WebUI source copying.
- Do not add `data-action` imperative handlers for Vue-owned actions.
- Do not remove a legacy bridge installer without moving its remaining behavior to a real owner and updating contract tests.
- Do not add a new state-management library for local page state.
- Do not put secrets, raw cookies, or WebUI passwords into visible text, logs, or test fixtures.
- Do not make visual changes without checking responsive behavior when the task touches layout.

---

## Required Patterns

### WebUI Legacy Bridge Cleanup

When removing a transitional `src/docker/webui/*` legacy bridge, move any remaining behavior into the module that owns the real lifecycle before deleting the bridge installer. For example, event binding and auto-refresh belong in `legacy-app.ts` while Vue-owned button handlers stay in page composables/components.

After deleting a bridge:

* Remove its installer from `src/docker/webui/main.ts`.
* Remove the deleted bridge file.
* Update `test/project-maintenance-contract.test.js` to assert both the new owner behavior and the absence of the old `window.DOUYU_KEEP_WEBUI_*` bridge.
* Keep user-facing text and API calls unchanged unless the task explicitly includes behavior changes.

Wrong:

```typescript
// Deleting an installer without preserving its remaining event/listener behavior.
installLegacyEventBridge()
```

Correct:

```typescript
bindLegacyEvents({
  state,
  handleVueNavigation,
  refreshOverviewSurface,
  loadOverview,
  triggerTask,
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
- Update `test/project-maintenance-contract.test.js` when adding, deleting, or moving core WebUI components, bridges, or build files.
- Include screenshots for user-visible layout changes before opening a PR, per `CONTRIBUTING.md`.

---

## Code Review Checklist

- Does the change keep Vue-owned UI declarative?
- Are composables cleaning up listeners?
- Are server responses narrowed from `unknown` before use?
- Are legacy bridge responsibilities preserved or intentionally removed with tests?
- Does layout still fit at mobile and desktop widths?
- Does the Docker WebUI still build through Vite?
