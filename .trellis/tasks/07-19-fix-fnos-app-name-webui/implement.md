# Implementation Plan

1. Update fnOS display names and switch the desktop entry to external `url` mode.
2. Add the fnOS install wizard port field with default `51417` and numeric validation.
3. Change manifest and UI port declarations to `${wizard_port}` while preserving the Compose `${TRIM_SERVICE_PORT}:51417` mapping.
4. Extend `test/fnos-packaging-contract.test.js` for metadata, wizard, and configurable host-port contracts.
5. Run focused fnOS tests, full `npm test`, and Compose metadata validation.
6. Run Trellis quality checks, activate and finish the task, then publish the corrected FPK under the approved release tag.
