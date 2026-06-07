# Test And Spec Redundancy Scan

## Scope

Scanned maintained repository-owned tests and Trellis specs:

- `test/*.test.js`
- `test/helpers/*.js`
- `.trellis/spec/**/*.md`

Excluded generated/dependency noise such as `node_modules`, build outputs, task archives, and Trellis backups when measuring maintained duplication.

## Commands

```bash
find test -type f -maxdepth 3 -print0 | xargs -0 wc -l | sort -n
find .trellis/spec -type f -maxdepth 3 -print0 | xargs -0 wc -l | sort -n
npx --yes jscpd@4.0.5 --min-lines 8 --min-tokens 60 --reporters console --ignore "**/node_modules/**,**/build/**,**/dist/**,**/.trellis/tasks/**,**/.trellis/.backup-*/**,**/package-lock.json" --format javascript,markdown test .trellis/spec
```

## Size Findings

Tests:

- Total maintained test size is about 3,054 lines.
- Largest files are `test/douyu-passport-contract.test.js` at about 893 lines and `test/project-maintenance-contract.test.js` at about 742 lines.
- `test/server-route-guardrails-contract.test.js` is also large at about 435 lines.
- Shared inspection plumbing already exists in `test/helpers/source-inspection.js` from the previous cleanup task.

Specs:

- Total current `.trellis/spec` size is about 2,470 lines.
- Largest files are `.trellis/spec/frontend/state-management.md` at about 478 lines and `.trellis/spec/backend/database-guidelines.md` at about 298 lines.
- Text-level clone detection found no markdown clones in `.trellis/spec`.

## Duplication Findings

`jscpd` on maintained tests and specs found:

- Markdown specs: 18 files, 2,416 lines, 0 clones, 0 duplicated lines.
- JavaScript tests: 13 files, 3,053 lines, 7 clones, 88 duplicated lines, about 2.88%.
- Total tested scope: 31 files, 5,469 lines, 7 clones, 88 duplicated lines, about 1.61%.

JavaScript clone hotspots:

- `test/server-route-guardrails-contract.test.js` repeats authenticated request setup around route tests.
- `test/project-maintenance-contract.test.js` repeats WebUI component file sets between Vue-only and ownership guardrails.
- `test/douyu-passport-contract.test.js` repeats cookie-source manager setup, temp config paths, and credential recovery fixtures.

## Interpretation

The current duplication level is not high enough to justify a broad delete/rewrite pass. The main maintenance issue is not raw repeated lines; it is dense contract-test guardrails and scenario-heavy specs that can become noisy during unrelated refactors.

`test/project-maintenance-contract.test.js` intentionally uses source inspection to guard architecture boundaries. Some repeated file lists are the same conceptual surface and can be named once, but hiding every assertion behind generic helpers would make the contracts harder to review.

`test/douyu-passport-contract.test.js` contains repeated fixtures around secret-bearing cookie recovery and QR login flows. Local helpers for temp config manager setup and complete cookie strings could reduce noise while preserving explicit assertions.

`.trellis/spec/frontend/state-management.md` and `.trellis/spec/backend/database-guidelines.md` are long because they hold many scenario contracts. They are not textually duplicated, but some older scenario-specific details may now be duplicated by tests or narrower specs. Any cleanup should preserve still-live contracts, especially around secrets, CookieCloud, Passport QR, and force refresh.

## Candidate Cleanup Areas

### Low-Risk

- Add local test helpers for repeated login/authenticated request setup in `test/server-route-guardrails-contract.test.js`.
- Name repeated WebUI component file sets in `test/project-maintenance-contract.test.js` when the same conceptual surface is asserted in multiple tests.
- Add local helper functions in `test/douyu-passport-contract.test.js` for temp config manager setup and repeated complete main/Yuba/passport cookie fixtures.

### Medium-Risk

- Split or relabel mixed maintenance tests only where a behavior assertion can replace a brittle source-text assertion without weakening an architecture boundary.
- Compress spec scenario sections that are now over-specific after implementation, replacing repeated narrative with concise contracts plus test references.

### Not Recommended For This Task

- Delete contract tests solely because they are source-text based.
- Remove spec scenarios solely because they are long.
- Rewrite the test suite around a new framework.
- Delete `.trellis/.backup-*` directories as part of this task unless the user explicitly scopes Trellis backup cleanup.

## Suggested MVP

Prefer a conservative cleanup pass:

1. Reduce repeated test fixtures and setup helpers in the three hotspot test files.
2. Keep all existing contract coverage and labels.
3. Optionally trim only clearly stale or duplicated spec prose discovered while editing, with an explicit before/after rationale.
4. Verify with `npm run test:contracts`, plus lint/type-check if test helper edits affect linted files.

## Post-Implementation Result

Implemented the conservative test-cleanup MVP only:

- `test/server-route-guardrails-contract.test.js`: repeated login setup moved to a local helper.
- `test/project-maintenance-contract.test.js`: repeated WebUI component source surface named once.
- `test/douyu-passport-contract.test.js`: repeated cookie/recovery/manager fixtures moved to focused local helpers.
- `.trellis/spec/**`: left unchanged.

Final local duplicate scan over `test` plus `.trellis/spec` found:

- Markdown specs: 0 clones, 0 duplicated lines.
- JavaScript tests: 0 clones, 0 duplicated lines.

Verification:

- `npm run test:contracts`
- `npm run lint`
- `npm run type-check`
