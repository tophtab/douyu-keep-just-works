# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This project no longer has a standalone Vue/Electron renderer. The supported UI is the Docker WebUI static document shell in `src/docker/webui/index.html`, with ordered source CSS and JavaScript files in `src/docker/webui/`, served through the lightweight renderer in `src/docker/webui.ts`.

The legacy Vue renderer guidelines below are retained only as historical references. For current UI changes, treat `src/docker/webui/index.html` and `src/docker/webui.ts` as Docker runtime code and read the backend guidelines first.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Legacy Vue renderer module organization | Legacy |
| [Component Guidelines](./component-guidelines.md) | Legacy Vue SFC patterns | Legacy |
| [Hook Guidelines](./hook-guidelines.md) | Legacy Vue reusable-logic patterns | Legacy |
| [State Management](./state-management.md) | Legacy Vue state patterns | Legacy |
| [Quality Guidelines](./quality-guidelines.md) | Legacy Vue quality guidance | Legacy |
| [Type Safety](./type-safety.md) | Legacy Vue type patterns | Legacy |

---

## Pre-Development Checklist

Before changing current UI code:

1. Read `../backend/directory-structure.md` for Docker-only runtime boundaries
2. Read `../backend/error-handling.md` for route error responses
3. Read `../backend/logging-guidelines.md` if diagnostics or logs change
4. Read `../backend/quality-guidelines.md` before final review

Do not reintroduce `src/renderer/`, Vue, Vite, Pinia, Vuetify, or Electron renderer IPC unless desktop support is explicitly restored.

## Current Docker WebUI Accessibility Checklist

When changing files under `src/docker/webui/`, keep the plain HTML controls accessible:

- Interactive controls need visible `:focus-visible` states, including custom switches and icon-only buttons.
- Async feedback needs a live region (`role="status"` / `aria-live="polite"`), especially toast and validation/status text.
- ARIA tab semantics require selected state, controlled panels, and keyboard navigation for arrow/Home/End keys.
- Dynamically generated table inputs need row-specific accessible names.
- Tables and log-style lists should use tabular numerals for comparable numbers and timestamps.
- Docker WebUI tables should define stable column roles and widths together: use scoped headers (`scope="col"`), align numeric headers with numeric cells, center control/status columns, and keep header/body padding on the same rhythm.
- Read-only status/detail tables should keep key names, row errors, and primary labels readable instead of blindly forcing one-line ellipsis; add a compact mobile representation when horizontal scrolling hurts scanability.
- Theme changes should keep `color-scheme` and `theme-color` aligned with the resolved theme.
- Motion and hover transforms must honor `prefers-reduced-motion`.

## Current Docker WebUI Source Split

- Keep `index.html` as the HTML shell and place styles/scripts under `src/docker/webui/`.
- `src/docker/webui.ts` injects ordered CSS and ordered JavaScript files into the served HTML response; do not add static asset routes unless the deployment contract explicitly changes.
- When adding a WebUI CSS file, add it to the ordered style list in `src/docker/webui.ts`. Later files may depend on earlier base variables and layout rules.
- When adding a WebUI script file, add it to the ordered script list in `src/docker/webui.ts`. Files that define globals for later scripts, such as `app-data.js`, `app-routing.js`, `app-dom.js`, `app-state.js`, `app-managed-data.js`, `app-table-render.js`, `app-render.js`, `app-pages.js`, `app-*-resource-actions.js`, `app-actions.js`, `app-*-task-actions.js`, and `app-events.js`, must appear before the consumers.
- Keep `app.js` as the main client-side behavior file. Small data/config-only files may sit beside it when they reduce noise in the main script.
- Keep `styles.css` as the base stylesheet. Component, table, and responsive CSS may sit in adjacent `styles-*.css` files when that keeps each source file readable.
- If a contract test needs to inspect client-side functions, read `src/docker/webui/app.js` instead of `index.html`. If a test verifies the injection contract, include every style/script file in the ordered lists.

---

**Language**: All documentation should be written in **English**.
