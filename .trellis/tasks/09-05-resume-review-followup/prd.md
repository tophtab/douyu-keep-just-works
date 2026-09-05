# Finish the Deferred Research Record

## Goal

Finish the previous documentation handoff, correct its missing evidence, and
explain why unnecessary application checks ran despite the change being
documentation-only. Audit the existing and historical SPEC requirements while
preserving the user's decision to defer intimacy-cap functionality.

## Background

- The user approved creating this task and asked to continue the unfinished
  work referenced by Codex session `01a070eb-f245-7c21-a1bc-c9b4bdb0e40e`.
- That session is a continuation of `01a06fbd-7978-7ca3-a234-be2c3a5959e2`.
  The recovered user request was to shelve the feature because it interrupts
  viewing, and preserve the interface research under Trellis conventions.
- The task-related existing changes are `.gitignore`, the intimacy research
  spec, backend index/contracts links, and the developer journal/index.
  Application source, tests, dependencies, and build configuration are unchanged.
  The other pre-existing changes belong to a Trellis tooling upgrade.
- Evidence and original command outcomes are recorded in
  [the recovery findings](./research/session-recovery.md).
- The user subsequently authorized judgment on the factual correction, affirmed
  that recording the research and shelving the feature were correct, explicitly
  rejected code checks for this change, and requested an audit of the old SPEC
  requirements before proposing any new rule.

## Requirements

- R1: Explain that the original documentation change did not justify running
  the application quality gate. Acknowledge the redundant type-check and
  contract-test execution without blaming the user or describing unrelated
  checks as coverage of the research.
- R2: Correct the missing `2500` evidence in
  `.trellis/spec/backend/douyu-fan-intimacy.md`. The retained HAR contains room
  `71415`, level `21`, `afim=250`, `mafim=250000`, and `tf=0`. Preserve the
  distinction between an old offline capture and a current live observation.
- R3: Preserve the correct previous outcome: documentation was recorded and the
  feature was shelved. Capture the unnecessary check execution in the recovery
  findings without making code checks a prerequisite for documentation handoff
  or treating the original documentation-complete status as a defect.
- R4: Audit the validation requirements that actually existed, their Git
  history, and the rules read in the original session. Distinguish a removed
  mandatory check list, a positive docs-only exemption, and conditional
  code/CI requirements. Do not add a duplicate policy before establishing facts.
- R5: Finish the documentation handoff with an accurate account of completed
  work, validation, deferred functionality, and Git state.

## Acceptance Criteria

- [x] AC1 / R1: The user receives the change scope and test rationale, including
  the original unnecessary and repeated checks.
- [x] AC2 / R2: The research record retains the sanitized room `71415` evidence
  and does not describe the `2500` example as lacking a recoverable room.
- [x] AC3 / R3: The documentation-complete and feature-deferred outcome is
  preserved; historical code checks are recorded as unnecessary, not a handoff
  requirement, and no unobserved result is marked successful.
- [x] AC4 / R4: The report identifies the historical removal and reintroduction
  of validation rules, their actual scope, and the original session's rule
  reads, with concrete sources. Existing quality guidelines remain unchanged.
- [x] AC5 / R5: Document links and whitespace are valid, captures remain ignored
  and untracked, no credentials or raw login frames enter shared artifacts,
  and the handoff reports the actual Git state.

## Scope and Constraints

- This is a lightweight documentation correction. `prd.md` is sufficient;
  no architecture or implementation redesign is required.
- Main-session ownership: the factual research-spec correction and this task's
  audit artifacts. The existing journal's correct completion/deferral decision
  is preserved. Any verification must use the same limited scope.
- Preserve all existing unrelated Trellis upgrade changes. Do not absorb them
  into this task or treat TypeScript checks as validation of Python tooling.
- No application code, dependency, build, runtime configuration, or test changes.
- No new live Douyu connections, CookieCloud calls, browser sessions, gift sends,
  background cap queries, or resumed cap-aware allocation.
- No changes to generated Trellis skills, workflow, scripts, or Cursor hooks.
- Do not rerun application tests merely to recover an irrelevant historical
  process result. Its unconfirmed completion can be recorded as such.
- Feature implementation, upstream protocol revalidation, and gift-budget
  semantics remain deferred under the original user decision.
