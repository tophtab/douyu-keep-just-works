# Ignore Trellis migration outputs

## Goal

Review the repository after `trellis update --migrate`, keep Trellis-managed migration files under version control, and ensure only local-only Trellis state stays ignored or untracked.

## Requirements

- Inspect the current post-migration git changes and distinguish Trellis-managed files from local-only runtime or identity files.
- Do not add `.gitignore` rules that would hide Trellis-managed workflow, skill, agent, script, or config files introduced by the migration.
- Ensure local-only Trellis identity/runtime artifacts are not tracked by git.
- Commit the resulting repository state and push it to `origin/master`.

## Acceptance Criteria

- [ ] Post-migration Trellis-managed files remain visible to git and are not added to ignore rules by mistake.
- [ ] Local-only Trellis artifacts are ignored or untracked according to Trellis conventions.
- [ ] `git status --short --ignored` shows the intended ignore behavior for the touched Trellis local-only paths.
- [ ] A commit containing the Trellis migration follow-up is created and pushed to `origin/master`.

## Confirmed Facts

- `trellis update --migrate` changed many Trellis-managed files under `.trellis/`, `.agents/skills/`, and `.cursor/skills/`, and added new bundled skill directories plus `.trellis/agents/`.
- Trellis documentation in `.agents/skills/trellis-meta/references/local-architecture/generated-files.md` marks `.trellis/.runtime/` as runtime state and `.trellis/.developer` as developer identity, both local-oriented files.
- `.trellis/.gitignore` already ignores `.developer`, `.runtime/`, backup directories, and Python cache files.
- `.trellis/.developer` is currently tracked in git even though Trellis documents it as local-only developer identity.

## Out Of Scope

- Editing Trellis-managed migration content for behavior changes unrelated to ignore/tracking cleanup.
- Changing task/workspace archival policy for older Trellis task directories.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
