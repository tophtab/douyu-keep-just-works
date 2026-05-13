# Frontend Development Guidelines

> Conventions for the Docker WebUI Vue/Vite frontend.

---

## Overview

The maintained frontend is the Docker WebUI under `src/docker/webui/`. It is built by Vite, type-checked by `vue-tsc`, and served as static Docker assets by backend WebUI routes.

The codebase is currently in a transitional state: Vue components own the user-facing surface, while several `installLegacy*Bridge` modules still provide compatibility with older imperative page logic. Preserve those bridges until a task explicitly removes a bridge and updates the contract tests.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Component, page, composable, and style layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Vue composables and event/data patterns | Filled |
| [State Management](./state-management.md) | Local, shared, server, and legacy bridge state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Linting, testing, accessibility | Filled |
| [Type Safety](./type-safety.md) | TypeScript and validation patterns | Filled |

---

## Pre-Development Checklist

Before frontend changes:

- Read `CONTRIBUTING.md`, especially Docker WebUI build requirements.
- Read [Directory Structure](./directory-structure.md) before adding or moving WebUI files.
- Read [Component Guidelines](./component-guidelines.md) before editing Vue components.
- Read [Hook Guidelines](./hook-guidelines.md) before adding composables or bridge event handlers.
- Read [State Management](./state-management.md) before changing data loading, refresh, or legacy bridge state.
- Read [Type Safety](./type-safety.md) before changing config/API shapes.
- Read [Quality Guidelines](./quality-guidelines.md) before final verification.

---

**Language**: All documentation should be written in **English**.
