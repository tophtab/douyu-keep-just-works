# Component Guidelines

> How Vue components are built in this project.

---

## Overview

Components use Vue 3 single-file components with `<script setup lang="ts">`. The root app composes shell components and page components, while page-specific behavior is usually provided by composables in sibling TypeScript modules.

---

## Component Structure

Use typed props and emits at the top of `<script setup>`:

```vue
<script setup lang="ts">
defineProps<{
  loginError: string
  password: string
  submittingLogin: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:password': [value: string]
}>()
</script>
```

Keep templates declarative. Prefer passing callback props or emitting events over querying DOM nodes for Vue-owned controls.

---

## Props Conventions

- Use `defineProps<T>()` with inline interfaces for component-local shapes.
- Import shared domain types from `src/core/types.ts` when the shape crosses backend/frontend boundaries.
- For `v-model`, expose `update:*` emits as shown in `AuthShell.vue`.
- Function props are accepted for shell-level composition when the caller owns navigation or task actions, as in `AppShell.vue`.

---

## Styling Patterns

Current styling is global CSS imported by `main.ts`:

```typescript
import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/tables.css'
import './styles/responsive.css'
```

Use existing classes such as `btn`, `actions`, `page`, `field-block`, and table classes before inventing new styling primitives. Keep repeated visual structures as components rather than copying large template blocks.

---

## Accessibility

Current patterns to preserve:

- Login errors use `role="alert"`.
- Toast live updates use an off-screen `role="status"` region with `aria-live="polite"`.
- Page sections use tabpanel semantics and `aria-hidden`/`hidden` tied to the active tab.
- Inputs have visible labels connected with `for`/`id`.
- Navigation key handling is centralized by `usePageNavigation`.

---

## Common Mistakes

- Do not add imperative `data-action` handlers for Vue-owned controls.
- Do not hide authenticated shell state with inline `style="display:none"`; use Vue state as in `App.vue`.
- Do not put API fetch logic directly into deeply presentational table components.
- Do not create a new one-off CSS theme when existing global styles cover the surface.
