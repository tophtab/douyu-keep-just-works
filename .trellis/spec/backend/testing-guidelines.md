# Testing Guidelines

> Contract-test taxonomy and modernization rules for the Docker-first runtime.

---

## Overview

Contract tests in this repo protect both observable behavior and architecture
boundaries. Do not modernize them by removing every source-text check. First
classify the contract, then choose the lowest-noise test style that still
protects the real boundary.

Use these labels in test comments when a contract block mixes several concerns
or when the right future test shape is not obvious:

- `Guardrail`
- `Behavior`
- `Shape`
- `Mixed`

## Categories

### Guardrail

Use `Guardrail` when the file, import boundary, forbidden token, or required
static structure is the contract.

Good fits:

- Deleted legacy WebUI files must stay deleted.
- Docker WebUI must stay Vue-only and Vite-built.
- Task runners must not directly call Passport `safeAuth`, `LTP0`, or cookie
  recovery helpers.
- Build metadata must stay aligned across Docker, package scripts, CI, and docs.

Source-text or filesystem assertions are acceptable here because the static
boundary itself is what must not regress.

### Behavior

Use `Behavior` when the externally observable result is the contract.

Good fits:

- Express routes authenticate, validate, and return the expected JSON envelope.
- Public config routes mask secrets while raw internal routes stay raw.
- Cache force-refresh options are forwarded to the right runtime methods.
- Config normalization and reconciliation produce the expected data.

Prefer route-level tests through `createServer(ctx)` or module-level tests with
`test/helpers/typescript-module-loader.js`. Avoid source-text regexes for these
contracts unless no practical behavior seam exists yet.

### Shape

Use `Shape` when a test asserts exact implementation form, such as helper names,
import paths, or function-body sequences.

Shape tests are the highest-maintenance category. Keep them narrow, explain the
temporary reason, and treat them as candidates for future behavior replacement
or a smaller `Guardrail` assertion.

### Mixed

Use `Mixed` when one `test(...)` block contains more than one category.

Mixed blocks are acceptable for broad maintenance contracts, but they should be
the first place to look when refactors become noisy. Future modernization should
split or replace the behavior/shape portions without weakening the guardrail
portions.

## Modernization Rules

- Label before replacing. Make the contract category explicit before changing
  assertion style.
- Preserve real guardrails. Do not delete source checks for forbidden legacy
  files, direct secret handling, or architecture boundaries unless an equal or
  stronger check replaces them.
- Prefer behavior tests for route auth, editable config reads, overview summary
  secret boundaries, validation, cache forwarding, and config normalization.
- Keep labels concise. One label per `test(...)` block is usually enough; add
  assertion-group comments only when a block is unusually dense.
- Do not mix file splitting with assertion replacement unless the task
  explicitly scopes both. Movement churn makes coverage changes harder to
  review.

## Source Inspection Helpers

When a contract test reads repository source files or extracts function bodies,
reuse `test/helpers/source-inspection.js` instead of duplicating local filesystem
and brace-walking helpers.

Use:

- `readRepoFile(relativePath)` for source text.
- `repoPath(relativePath)` for filesystem existence checks.
- `collectRepoFiles(relativeDir)` for recursive repo file lists.
- `getFunctionBody(source, name)` / `getAsyncMethodBody(source, name)` for
  narrow source-shape assertions.

Keep the helper focused on inspection mechanics. Do not hide the actual
architecture or behavior assertion behind a generic helper; the test body should
still make the contract obvious.

## Review Checklist

- Is the contract labeled as `Guardrail`, `Behavior`, `Shape`, or `Mixed` when
  the category is not obvious?
- If the test reads source text, is the static source shape itself the contract?
- If the test verifies route or helper behavior, could it use `createServer(ctx)`
  or `loadTypeScriptModule(...)` instead of regex?
- If a `Mixed` block is being changed, are the guardrail assertions preserved?
- Are raw cookies, WebUI passwords, CookieCloud passwords, `LTP0`, and returned
  auth tokens absent from public responses, logs, docs, and visible UI fixtures?
