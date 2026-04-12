# Rename Project and Docker Branding

## Goal
Rename the project branding from `douyu-keep` / `douyu-keep-docker` to `douyu-keep-just-works`, update Docker naming to `tophtab/douyu-keep-just-works`, and refresh the README with a more polished GitHub presentation.

## Requirements
- Update project-facing names to `douyu-keep-just-works` where they are used as branding or package identifiers.
- Update Docker Compose and Docker image examples to use `tophtab/douyu-keep-just-works`.
- Keep runtime behavior unchanged apart from naming and display text.
- Add a short README section explaining the "It Just Works" meme, its Todd Howard origin, and how the phrase maps to the project's AI-oriented philosophy.
- Rewrite the README copy in a cleaner, more GitHub-friendly style with a playful, humorous tone.
- Fix Docker release tagging so published tags move forward with the project version instead of staying on `1.1`.

## Acceptance Criteria
- [ ] Project metadata and packaging names use `douyu-keep-just-works` where appropriate.
- [ ] Docker Compose examples and container naming reflect the new image namespace `tophtab`.
- [ ] README includes an "It Just Works" explanation with light humor and AI framing.
- [ ] README structure is cleaner and more polished than before.
- [ ] The project version is bumped to `1.2.0` and Docker release tags derive from the updated version.
- [ ] TypeScript builds still pass after the rename-related edits.

## Technical Notes
- Avoid changing low-level identifiers that could break existing desktop installs unless the change is clearly branding-only.
- Update only the files needed for project metadata, Docker examples, and startup naming.
