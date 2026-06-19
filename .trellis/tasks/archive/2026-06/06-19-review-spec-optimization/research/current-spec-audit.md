# Current Spec Audit

## Scope

Reviewed `.trellis/spec/**/*.md`, the current Trellis loading rule in
`.agents/skills/trellis-before-dev/SKILL.md`, and prior related task history.

## Current Inventory

- Files: 19 Markdown files under `.trellis/spec/`.
- Total size: about 2,590 lines.
- Layers:
  - backend: 9 files including index.
  - frontend: 7 files including index.
  - guides: 3 files including index.

Largest files:

| File | Lines | Scenario contracts |
|---|---:|---:|
| `.trellis/spec/frontend/state-management.md` | 478 | 6 |
| `.trellis/spec/backend/database-guidelines.md` | 298 | 3 |
| `.trellis/spec/backend/error-handling.md` | 205 | 1 |
| `.trellis/spec/backend/quality-guidelines.md` | 166 | 0 |
| `.trellis/spec/guides/cross-layer-thinking-guide.md` | 162 | 0 |
| `.trellis/spec/frontend/component-guidelines.md` | 154 | 0 |

## Prior Relevant History

`.trellis/tasks/archive/2026-06/06-07-cleanup-test-spec-redundancy/` already
ran a combined test/spec redundancy scan. It found:

- Markdown specs had no detected text clones.
- The spec issue was scenario-heavy density, not duplicate paragraphs.
- Broad scenario deletion was not recommended because the docs protect
  high-risk behavior around secrets, CookieCloud, Passport QR, WebUI bridges,
  and force refresh.

The current scan is consistent with that result.

## Loading-Cost Findings

`trellis-before-dev` tells agents to read:

- the task artifacts,
- relevant package/layer indexes,
- relevant checklist files from those indexes,
- shared guides index every time.

The indexes have trigger wording, but they do not provide a lightweight routing
table that lets an agent select individual scenario contracts inside a large
file. For broad backend/frontend tasks, this nudges agents toward reading many
full files even when only one scenario contract is relevant.

## Content Findings

The long files are long for structural reasons:

- `frontend/state-management.md` combines daily state rules with six concrete
  scenario contracts: initial theme injection, resource error feedback, manual
  force refresh, config save response application, CookieCloud sync/check, and
  Passport QR polling.
- `backend/database-guidelines.md` combines config persistence rules with three
  scenario contracts: default config ownership, manual passport recovery
  material, and project-owned QR login snapshots.
- `backend/error-handling.md` combines general error rules with a credential
  recovery retry scenario.
- `backend/quality-guidelines.md` combines daily quality rules with Docker image
  build cache contracts and task metadata ownership.

These sections are not obvious duplicates. Several encode live security and
operational contracts that are easy to regress.

## Optimization Approaches

### Approach A: Conservative routing/index cleanup

Add better routing metadata to indexes and maybe short "read this when" maps at
the top of large files. Keep content in place.

Benefits:

- Lowest risk to project memory.
- Reduces unnecessary full-file reads for future agents.
- Does not require deciding whether old scenario contracts are stale.

Costs:

- Does not reduce total line count much.
- Large files remain large.

### Approach B: Split scenario contracts from daily guidelines

Move scenario contracts into dedicated files such as
`frontend/scenarios/*.md` or `backend/contracts/*.md`, and keep top-level
guidelines concise with links and triggers.

Benefits:

- Preserves contract content while making everyday guidelines shorter.
- Makes high-risk contracts easier to target by trigger.
- Gives future spec updates a clearer destination.

Costs:

- More files, so the user's "too many specs" concern may worsen if file count is
  the metric.
- Requires updating indexes and any task references.

### Approach C: Compress scenario contracts

Rewrite older scenario sections into shorter contracts plus test references,
removing Good/Base/Bad or Wrong/Correct examples where tests now encode the
detail.

Benefits:

- Reduces actual line count.
- Can make docs easier to scan.

Costs:

- Highest risk of losing future-agent guardrails.
- Needs per-scenario stale/covered-by-test evidence before deletion.

## Recommended Direction

Start with Approach A, then selectively apply Approach B only to the largest
mixed-responsibility files if line count still hurts. Avoid Approach C until a
specific scenario is shown stale or fully superseded by tests and narrower docs.

The first practical change would be:

1. Add a compact routing table to `backend/index.md`, `frontend/index.md`, and
   `guides/index.md`.
2. Add a scenario map at the top of `frontend/state-management.md`,
   `backend/database-guidelines.md`, `backend/error-handling.md`, and
   `backend/quality-guidelines.md`.
3. Update checklist wording so agents read only triggered scenario sections when
   the task is narrow.

This targets the observed pain, which is reading cost, while preserving the
contracts that prevent known regressions.
