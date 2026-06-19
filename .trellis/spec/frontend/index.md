# Frontend Development Guidelines

> Conventions for the Docker WebUI Vue/Vite frontend.

---

## Overview

The maintained frontend is the Docker WebUI under `src/docker/webui/`. It is built by Vite, type-checked by `vue-tsc`, and served as static Docker assets by backend WebUI routes.

The maintained WebUI runtime is Vue-only. `src/docker/webui/main.ts` should mount the Vue app and import styles; it must not start an older imperative app, install `installLegacy*Bridge` compatibility modules, or register `window.DOUYU_KEEP_WEBUI_*` globals other than the bootstrap data injected by `index.html`.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Component, page, composable, and style layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Vue composables and event/data patterns | Filled |
| [State Management](./state-management.md) | Local, shared, and server state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Linting, testing, accessibility | Filled |
| [Type Safety](./type-safety.md) | TypeScript and validation patterns | Filled |
| [Frontend Contracts](./contracts.md) | Scenario contracts for high-risk WebUI behavior | Filled |

---

## Read Routing

Use this table before opening every frontend spec file.

| Change area | Read |
|---|---|
| Adding or moving WebUI files | [Directory Structure](./directory-structure.md) |
| Editing Vue components, shared section/table components, UI copy, or accessibility markup | [Component Guidelines](./component-guidelines.md) |
| Adding composables, event handlers, or task page actions | [Hook Guidelines](./hook-guidelines.md) |
| Changing local/shared/server state ownership, resource loaders, or protected shell mounting | [State Management](./state-management.md) |
| Theme bootstrap, resource error feedback, manual force refresh, save-response application, CookieCloud sync/check, or Passport QR polling | [Frontend Contracts](./contracts.md) |
| Changing API/config shapes or validation | [Type Safety](./type-safety.md), [Frontend Contracts](./contracts.md) when a scenario trigger matches |
| Final frontend verification, Vue-only runtime, build behavior, or accessibility checks | [Quality Guidelines](./quality-guidelines.md) |

---

## Pre-Development Checklist

Before frontend changes:

- Read `CONTRIBUTING.md`, especially Docker WebUI build requirements.
- Read [Directory Structure](./directory-structure.md) before adding or moving WebUI files.
- Read [Component Guidelines](./component-guidelines.md) before editing Vue components.
- Read [Hook Guidelines](./hook-guidelines.md) before adding composables or shared app event handlers.
- Read [State Management](./state-management.md) before changing data loading, refresh, or shared resource state.
- Read [Type Safety](./type-safety.md) before changing config/API shapes.
- Read [Quality Guidelines](./quality-guidelines.md) before final verification.
- Read the matching section of [Frontend Contracts](./contracts.md) when the change matches a row in Read Routing.

---

**Language**: All documentation should be written in **English**.
