# Fix remaining yuba sign failures

## Goal
Reduce remaining fish-bar sign-in failures that still return a generic failure after the existing retry flow.

## Requirements
- Keep the yuba sign workflow in `src/core/` shared logic.
- Preserve the current sequential execution model and jittered pacing.
- Use real upstream response shapes to distinguish retriable vs terminal failures.
- Improve logs or retry behavior only when it helps diagnose or recover the remaining failures without exposing secrets.

## Acceptance Criteria
- [ ] Manual yuba sign runs no longer fail for the recoverable cases seen in the latest runtime log.
- [ ] Non-recoverable upstream failures still surface as clear task logs instead of being rewritten as success.
- [ ] Docker runtime behavior still compiles and keeps existing yuba contracts intact.

## Technical Notes
- Current failures happen after the existing "refresh exp and retry once" path.
- Real upstream response details must be captured without logging cookies or other secrets.
