# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

The supported UI is the Docker WebUI Vue/Vite application under `src/docker/webui-src/`, served by the Docker Express runtime after `npm run build:docker`.

The current WebUI source lives under `src/docker/webui-src/`. New UI structure should continue moving cohesive markup into Vue single-file components while preserving Docker deployment semantics.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Vue/Vite Docker WebUI module organization | Current |
| [Component Guidelines](./component-guidelines.md) | Vue SFC patterns | Current |
| [Hook Guidelines](./hook-guidelines.md) | Vue reusable-logic patterns | Current |
| [State Management](./state-management.md) | Vue state patterns | Current |
| [Quality Guidelines](./quality-guidelines.md) | Vue quality guidance | Current |
| [Type Safety](./type-safety.md) | Vue type patterns | Current |

---

## Pre-Development Checklist

Before changing current UI code:

1. Read `../backend/directory-structure.md` for Docker-only runtime boundaries and build contracts
2. Read this frontend index plus the relevant Vue guide for the files you are changing
3. Read `../backend/error-handling.md` if route responses or frontend API error handling change
4. Read `../backend/logging-guidelines.md` if diagnostics or logs change
5. Read `../backend/quality-guidelines.md` before final review

Do not reintroduce `src/renderer/`, Electron renderer IPC, Pinia, Vuetify, or a heavy UI framework unless support is explicitly restored for that scope.

## Current Docker WebUI Accessibility Checklist

When changing files under `src/docker/webui-src/` or transitional files under `src/docker/webui/`, keep the controls accessible:

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

- Keep Vue/Vite source under `src/docker/webui-src/`.
- Do not keep source files under `src/docker/webui/`; production assets in the built `webui/` directory come from Vite output.
- Keep shared Docker WebUI styles under `src/docker/webui-src/styles/`.
- `src/docker/webui-src/main.ts` owns the legacy module import order while the transition layer exists.
- `src/docker/webui-src/index.html` owns the Vite HTML shell and the `DOUYU_KEEP_WEBUI_BOOTSTRAP` runtime token placeholders.
- `src/docker/webui-src/App.vue` owns app-level composition and may delegate cohesive shell/page regions to `src/docker/webui-src/components/`.
- `src/docker/webui.ts` reads the Vite-built `webui/index.html`, injects app version and route tokens, and does not inline ordered scripts/styles.
- `src/docker/server-webui-routes.ts` serves Vite output from `WEBUI_ASSET_ROOT` with `express.static()` before returning the HTML shell for Docker WebUI page routes.
- If a test verifies the build contract, check `vite.config.ts`, `src/docker/webui-src/main.ts`, and `src/docker/server-webui-routes.ts`.

---

**Language**: All documentation should be written in **English**.
