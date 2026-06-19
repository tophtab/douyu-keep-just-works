# Implementation Plan: Spec Optimization

## Ordered Checklist

1. Re-read the relevant spec files before editing:
   - `.trellis/spec/backend/index.md`
   - `.trellis/spec/backend/contracts.md`
   - `.trellis/spec/backend/database-guidelines.md`
   - `.trellis/spec/backend/error-handling.md`
   - `.trellis/spec/backend/quality-guidelines.md`
   - `.trellis/spec/frontend/index.md`
   - `.trellis/spec/frontend/contracts.md`
   - `.trellis/spec/frontend/state-management.md`
   - `.trellis/spec/guides/index.md`
   - `.trellis/spec/guides/code-reuse-thinking-guide.md`
   - `.trellis/spec/guides/cross-layer-thinking-guide.md`
2. Add or update routing tables in backend, frontend, and guides indexes.
3. Create a backend contract surface and move/compress backend scenario
   contracts into it.
4. Trim backend daily guideline files so they keep daily rules and link to the
   contract surface for triggered scenarios.
5. Create a frontend contract surface and move/compress frontend state scenario
   contracts into it.
6. Trim frontend state-management daily guidance accordingly.
7. Compress shared guide prose where it repeats broad motivation, preserving
   concrete checklists and gotchas.
8. Re-run inventory commands and compare before/after file count and line count.
9. Review all moved-contract links from indexes and daily files.
10. Update `prd.md` with implementation summary and final measurements.

## Validation Commands

Documentation-only validation:

```bash
find .trellis/spec -maxdepth 4 -type f | sort
find .trellis/spec -type f -name '*.md' -print0 | xargs -0 wc -l | sort -n
rg -n "state-management.md|contracts.md" .trellis/spec .agents/skills .cursor/skills
rg -n "auth-cookie-lifecycle|douyu-pocket-contracts" .trellis/spec .agents/skills .cursor/skills
rg -n "\\[[^]]+\\]\\([^)]*\\.md\\)" .trellis/spec
```

Optional duplicate scan when npm registry/network is available:

```bash
npx --yes jscpd@4.0.5 --min-lines 8 --min-tokens 60 --reporters console --ignore "**/node_modules/**,**/build/**,**/dist/**,**/.trellis/tasks/**,**/.trellis/.backup-*/**,**/package-lock.json" --format markdown .trellis/spec
```

## Risky Files / Rollback Points

- `.trellis/spec/backend/database-guidelines.md`: contains config and passport
  persistence contracts.
- `.trellis/spec/backend/error-handling.md`: contains credential recovery retry
  contracts.
- `.trellis/spec/backend/contracts.md`: contains consolidated Passport/main/Yuba
  authority, credential recovery, config persistence, Douyu pocket, Docker
  image, and task metadata contracts.
- `.trellis/spec/frontend/contracts.md`: contains consolidated WebUI scenario
  contracts.
- `.trellis/spec/frontend/state-management.md`: contains most frontend scenario
  contracts.

Make edits in stages and inspect diff after each stage:

1. index/routing edits,
2. backend contract movement,
3. frontend contract movement,
4. compression pass.

Rollback can revert the latest stage if contract loss is detected.

## Implementation Summary

- Added `backend/contracts.md` and folded the old standalone backend scenario
  files into it.
- Added `frontend/contracts.md` and moved the scenario-heavy parts of
  `state-management.md` into it.
- Added read-routing tables to backend/frontend indexes.
- Compressed shared thinking guides while preserving concrete checklists.

## Verification Result

- `.trellis/spec` now has 19 Markdown files and 1,959 total lines, down from 19
  files and about 2,590 lines.
- `git diff --check -- .trellis/spec .trellis/tasks/06-19-review-spec-optimization`
  passed.
- Current `.trellis/spec`, `.agents/skills`, and `.cursor/skills` contain no
  references to deleted `auth-cookie-lifecycle.md` or
  `douyu-pocket-contracts.md`.
- Optional `jscpd` duplicate scan was interrupted after 90 seconds with no
  output because `npx` did not finish package startup/download.
