# Previous Session Recovery

Recovered on 2026-09-05 using local Trellis memory, retained Codex tool records,
Git state, and a numeric-only offline read of the existing HAR. No live Douyu
request, CookieCloud access, browser session, or application test was performed
for this recovery.

## Original Request and Change Ownership

The user-referenced session `01a070eb-f245-7c21-a1bc-c9b4bdb0e40e` contains the
test-rationale question and forks through several continuations from
`01a06fbd-7978-7ca3-a234-be2c3a5959e2`.

The latter session's user turn 61 shelves the feature because of its effect on
viewing and asks to retain the interface details under Trellis conventions.
Assistant turn 62 explicitly promises a documentation-only record.

Task-owned pre-existing paths:

- `.gitignore`: ignore private `.temp/` captures.
- `.trellis/spec/backend/douyu-fan-intimacy.md`: deferred research record.
- `.trellis/spec/backend/index.md`: discovery links.
- `.trellis/spec/backend/contracts.md`: double-card research pointer.
- `.trellis/workspace/toph/journal-2.md`: session 94.
- `.trellis/workspace/toph/index.md`: session index entry.

The initial worktree had 51 changed/untracked paths. The other 45 paths concern
the existing Trellis upgrade from 0.6.9 to 0.6.16. None of the task-owned paths
changes application source, tests, dependencies, or build configuration.

## Actual Historical Checks

All times below are UTC on 2026-09-05, as retained in the original tool records.

| Command/action | Evidence and outcome | Relevance |
|---|---|---|
| `npm run lint` | Started at 06:11:44; exit 0 retrieved at 06:12:06 | Application lint; unnecessary for this change |
| `npm run type-check` | Started at 06:11:44; exit 0 retrieved at 06:12:06 | Docker/WebUI types; unnecessary for this change |
| `npm run test:contracts` | Started at 06:11:44; 43 passed, 0 failed, exit 0 retrieved at 06:12:06 | Existing application contracts; unnecessary for this change |
| Poll the completed type-check again | At 06:12:32, returned `Unknown process id 97010` | The earlier call had already returned success; this was not a type-check failure |
| `npm run type-check` again | Started at 06:12:43; exit 0 | Redundant rerun after misreading process lifecycle |
| `npm test` | Started at 06:13:23 with process ID 70391; no final result recovered from the continuation chain | Repeats contract tests and runs a Docker build; unnecessary for this change; completion unconfirmed |

Assistant turn 69 describes the last command as necessary to complete the
Trellis quality gate. The user objects in turn 70. No final documentation
handoff was recovered after that objection.

The local `trellis-check` skill's Step 3 lists lint, type-check, and tests, and
the backend quality spec lists the Docker quality gate. The original tool
records show the backend quality spec being read at 05:59:47 and 06:04:13, then
`trellis-check/SKILL.md` being read at 06:10:54, before the commands above began.
The skill itself describes its purpose as verification of "recently written
code" and starts with identifying the changed files and applicable specs.
Applying its code commands to the research record was an applicability error.
The separate Python tooling upgrade is not covered by the application's
TypeScript checks either.

## Existing SPEC Rules and Their History

The user's recollection of an earlier removal of mandatory validation has
concrete Git evidence. Times in this table are Asia/Shanghai (UTC+08:00).

| Commit | Date and time | Relevant change |
|---|---|---|
| `810848f7d93f94ec7171d024ca2f971f2febfaab` | 2026-05-13 18:45:04 | `docs(spec): remove mandatory validation requirements`; deleted the backend/frontend `Testing Requirements` sections and validation material in other specs |
| `1022dd01d88a87f03b5cd54b3477f2b0e856b14a` | 2026-05-13 20:15:36 | `docs: bootstrap trellis guidelines`; reintroduced the backend lint/type-check/build/test quality gate and frontend/backend testing sections |

The bootstrap also replaced the earlier backend statement that lint targets
source/tests/config and should not be broadened to Markdown specs, Trellis
archives, or unrelated GitHub YAML. It removed the frontend instruction not to
broaden lint/test scopes to unrelated archived Trellis or generated output.
These were scope limits on check targets, not a blanket exemption from all
checks for every documentation-related change.

Relevant current evidence:

- `.agents/skills/trellis-check/SKILL.md:8`: the skill targets recently written
  code. Steps 1 and 2 require changed-file and applicable-spec identification;
  Step 3 contains the broad command instruction actually followed last time.
- `.trellis/spec/backend/quality-guidelines.md:27`: the reintroduced Docker
  quality gate remains. Its testing section still ties type-checking to
  TypeScript shape changes, but also says to run lint before handoff.
- `.trellis/spec/frontend/quality-guidelines.md:79`: lint/type-check applies to
  frontend code changes; builds have specific Vite/CSS/component triggers.
- `.trellis/spec/backend/contracts.md:374`: Docker image/CI contracts specify
  build-affecting triggers and path filters; the CI contract also avoids a
  duplicate build through `npm test`.
- `.trellis/tasks/archive/2026-06/06-19-review-spec-optimization/implement.md:33`:
  the previous spec-only task explicitly planned "Documentation-only
  validation" with inventory/reference/link review; no application quality
  commands are listed there. This is a task-specific precedent, not a global
  SPEC rule.
- `.github/workflows/docker.yml:8`: branch/PR path filters cover application,
  tests, build inputs, and the workflow itself. The current research Markdown
  and `.gitignore` change do not trigger that workflow on those events; release
  tags and manual dispatch have separate behavior.

The audit found a historical removal of mandatory testing instructions and
their later reintroduction, rather than an explicit current blanket sentence
saying every docs-only change is exempt. It would be inaccurate to say no such
scope work had existed, or to treat the later generic command list as sufficient
reason to run application tests for this research record.

The user has now explicitly confirmed that these code checks are unnecessary
for this change. The correct handoff remains "research recorded; feature
deferred". The audit records the mistaken execution without rewriting that
valid outcome or adding a new quality rule as an unrequested deliverable.

## Recoverable 2500 Sample

The original research record said that the user's `2500` observation lacked a
retained room identifier. Earlier session history identified a relevant HAR
record, which was independently confirmed offline during recovery. The research
spec now includes that historical room sample and its evidence limits.

Only numeric badge fields were selected from the existing `wsproxy` `blst`
message; raw frames, credentials, user identifiers, and device identifiers were
not printed or copied into this task.

| Field | Value |
|---|---:|
| `rid` | 71415 |
| `bl` | 21 |
| `afim` | 250 |
| `mafim` | 250000 |
| `tf` | 0 |
| `fim` | 13154420 |
| `nfim` | 14000000 |

The recorded display conversion maps raw cap `250000` to `2500`. This is a
historical capture that supports a concrete room example, not a fresh API query,
a universal base limit, or proof of the exact time of the user's UI observation.
The private HAR remains an ignored local input; it must not become a fixture or
be committed.

## Recovery Validation Already Completed

- Scoped `git diff --check` passed for the existing research, journal, ignore,
  and task-document paths.
- All 44 local Markdown link targets checked across the research spec, backend
  index, and contracts exist. This checks target files, not external URLs.
- `git check-ignore` confirms both private capture files and `.playwright-cli/`
  are ignored; `git ls-files` returns no tracked capture files.
- The historical application-test results above were read from logs, not
  rerun. Their success does not establish accuracy of the research document.

## Applied Documentation Corrections

- The research spec retains room `71415`, level `21`, `afim=250`,
  `mafim=250000`, and `tf=0`, with the `2500` display conversion explicitly
  attributed to an offline historical capture.
- Session 94 retains its correct documentation-complete and feature-deferred
  status. The unnecessary checks and the unconfirmed final `npm test` result
  are recorded above; they do not block or validate the research handoff.
- The historical SPEC audit is complete. The mandatory-check removal and later
  reintroduction are documented with commit IDs and their actual scope. No new
  quality rule or change to the existing quality guidelines was needed.
- The continuation reused the already approved task. Final review covered the
  documentation handoff only; the unrelated Trellis tooling upgrade remains
  outside this task.

## Final Static Review

The documentation review on 2026-09-05 passed with no findings or further edits
required:

- All 44 local file links, 10 same-document links, and 22 fragment targets
  checked in the research spec, backend index, and contracts resolve.
- Scoped whitespace checks passed, including a direct check of the new
  research file; no conflict markers were found.
- Both named private captures and `.playwright-cli/` remain ignored and
  untracked. Their contents were not read during this final review, and no
  credentials or raw login frames appear in the reviewed documentation.
- Backend and frontend quality guidelines are unchanged. Application source,
  tests, dependencies, build inputs, and runtime behavior are unchanged.
- No application lint, type-check, test, build, or live integration check was
  run for this continuation. The historical commands listed above remain an
  account of unnecessary work, not validation of the research record.

The task-owned Git changes consist of the research spec and its two backend
links, the private-capture ignore rule, this task's artifacts, and the journal.
The 45 pre-existing Trellis upgrade paths are preserved separately.
