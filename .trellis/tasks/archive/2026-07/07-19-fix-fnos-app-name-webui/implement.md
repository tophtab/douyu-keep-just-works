# Implementation Plan

1. Update fnOS display names and switch the desktop entry to external `url` mode.
2. Keep the manifest/UI/Compose service port contract fixed at `51417`.
3. Extend `test/fnos-packaging-contract.test.js` for corrected metadata and external URL entry contracts.
5. Run focused fnOS tests, full `npm test`, and Compose metadata validation.
6. Run Trellis quality checks, activate and finish the task, then publish the corrected FPK under the approved release tag.
