# Implementation Plan

1. Rename the config normalization module and update source, tests, and Trellis spec references.
2. Remove the three retired legacy conversions and update existing contract expectations for the current config shape.
3. Extract credential recovery stage functions without changing observable behavior.
4. Run lint, type-check, contract tests, Docker build, and production dependency audit.
5. Review the final diff for unrelated changes and confirm existing dirty Trellis/platform work remains untouched.
