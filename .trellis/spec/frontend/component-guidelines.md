# Component Guidelines

> How components are built in this project.

---

## Overview

Docker WebUI components use Vue single-file components with `<script setup lang="ts">`.

## Component Structure

Preferred file shape:

1. `<script setup lang="ts">`
2. imports from Vue and local helpers
3. typed props/state/helpers
4. `<template>`
5. optional scoped styles

## Props And Composition

- Keep one-off state local to the component or composable that owns it.
- Extract shared behavior into local helpers/composables only after repetition appears.
- Do not add Pinia solely to avoid passing a small amount of state.
- For Docker WebUI pages, keep request/persistence logic in the existing page composables and move markup into SFC page components. Shared shell controls can receive props/events, but should not duplicate API calls.
- For editable table rows passed into reusable table components, emit row/value events from the table and mutate the composable-owned row model in the page component.

## Styling Patterns

- Reuse the existing Docker WebUI CSS variables and classes unless a component genuinely needs local styling.
- Keep user-facing Chinese copy stable during framework-only migrations.
- Avoid adding a heavy UI library for basic buttons, forms, tables, or cards.

## Accessibility

- Preserve visible labels for form controls.
- Keep live regions for async validation/status text.
- Preserve tab semantics and keyboard navigation when moving markup into components.

## Common Mistakes

- Do not treat a Vue migration as a visual redesign unless the task explicitly asks for redesign.
- Do not split tiny one-off fragments into deep component trees.
- Do not let transitional legacy modules and Vue components race to own the same DOM region.
- Do not move a page composable into a reusable table/control component just to reduce props; keep reusable components presentational unless a repeated behavior clearly belongs there.
