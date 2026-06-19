# Cross-Layer Thinking Guide

> Map data flow and ownership before implementing cross-layer behavior.

---

## Core Checklist

Before implementation:

- [ ] Map the complete data flow: source -> transform -> store -> retrieve ->
  transform -> display.
- [ ] Identify every layer boundary.
- [ ] Define the format at each boundary.
- [ ] Decide where validation happens.
- [ ] Decide which module owns the contract.

After implementation:

- [ ] Test null, empty, invalid, and stale inputs.
- [ ] Verify error handling at each boundary.
- [ ] Check data survives a round trip.

Common mistakes:

- implicit format assumptions,
- scattered validation,
- components or routes depending on storage internals.

---

## Cross-Platform Template Consistency

Trellis command templates can exist across multiple platform directories with
near-identical content.

After modifying a command template:

- [ ] Find all platform copies:
  `find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] Update Markdown and TOML variants.
- [ ] For Gemini TOML, adapt line continuations and triple-quoted strings.
- [ ] Run `/trellis:check-cross-layer`.

Known failure: `record-session.md` was updated for one platform, but iFlow,
Kilo, OpenCode, and Gemini were missed; cross-layer check caught it.

---

## Runtime-Parsed Template Upgrade Consistency

Some generated files are also runtime input. `.trellis/workflow.md` is parsed by
`get_context.py`, `workflow_phase.py`, SessionStart filters, and per-turn hooks.

After modifying a runtime-parsed template:

- [ ] Identify every parser, not just the installer.
- [ ] Check whether relevant syntax lives outside managed tag blocks.
- [ ] Verify fresh `init` output.
- [ ] Verify a versioned `update` scenario from an older `.trellis/.version`.
- [ ] Add an upgrade regression with an older pristine fixture.
- [ ] Update the backend spec that owns the runtime contract.

Known failure: Codex inline platform markers changed in fresh templates, but
`trellis update` only merged workflow-state blocks and preserved stale markers
outside those blocks. Upgraded projects then had new hooks but old workflow
routing.

---

## Mode-Detection Probe Checklist

When a CLI auto-detects a mode by probing a remote resource:

Before implementing:

- [ ] Probe runs in every code path that uses the result, including
  interactive, `-y`, and shortcut flags.
- [ ] 404 and transient failures are distinguished.
- [ ] Transient failures abort or retry; they never silently switch modes.
- [ ] Shared state and prefetched data reset when source/context changes.
- [ ] Shortcut paths use the same error-handling quality as the probed path.

After implementing:

- [ ] Trace every path from probe result to mode decision.
- [ ] Test or document external format contracts such as giget URI and raw URLs.
- [ ] Read complete metadata responses or use a streaming parser; never parse a
  fixed-size prefix as full JSON.
- [ ] Reconstruct composite identifiers with all fields in the correct position.
- [ ] Verify downstream action functions do not use old catch-all fetch helpers.

Known failures:

- Custom registry flow had probe gaps, transient-error fallthrough, wrong giget
  `#ref` position, stale prefetched templates, and shortcut paths that bypassed
  probe-quality fetches.
- Agent-session update hints parsed only the first 4096 bytes of npm package
  metadata; the JSON was truncated and the update hint disappeared. Fix by
  reading the complete response and adding a regression with a large metadata
  tail.

---

## When To Create Flow Documentation

Create detailed flow docs when a feature spans 3+ layers, has complex formats,
has multiple implementation owners, or has caused bugs before.
