# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This project no longer has a standalone Vue/Electron renderer. The supported UI is the Docker WebUI static document in `src/docker/webui/index.html`, served through the lightweight renderer in `src/docker/webui.ts`.

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

When changing `src/docker/webui/index.html`, keep the plain HTML controls accessible:

- Interactive controls need visible `:focus-visible` states, including custom switches and icon-only buttons.
- Async feedback needs a live region (`role="status"` / `aria-live="polite"`), especially toast and validation/status text.
- ARIA tab semantics require selected state, controlled panels, and keyboard navigation for arrow/Home/End keys.
- Dynamically generated table inputs need row-specific accessible names.
- Tables and log-style lists should use tabular numerals for comparable numbers and timestamps.
- Docker WebUI tables should define stable column roles and widths together: use scoped headers (`scope="col"`), align numeric headers with numeric cells, center control/status columns, and keep header/body padding on the same rhythm.
- Read-only status/detail tables should keep key names, row errors, and primary labels readable instead of blindly forcing one-line ellipsis; add a compact mobile representation when horizontal scrolling hurts scanability.
- Theme changes should keep `color-scheme` and `theme-color` aligned with the resolved theme.
- Motion and hover transforms must honor `prefers-reduced-motion`.

---

**Language**: All documentation should be written in **English**.
