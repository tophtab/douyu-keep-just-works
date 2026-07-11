# Design

## Configuration Boundary

- Rename `src/core/medal-sync.ts` to `src/core/config-normalization.ts` because it owns Docker config defaults, normalization, and fan-backed reconciliation rather than medal synchronization.
- Preserve `normalizeDockerConfig`, `reconcileDockerConfig`, and the existing default-config factory exports to keep call sites behaviorally stable.
- Retire only formats that have direct current replacements: `percentage` -> `weight`, `manualPassport.ltp0` -> `manualPassport.cookie`, and missing `doubleCard.enabled` inferred from `send`.
- Keep sparse-field defaulting, trimming, current top-level `cookie`, and fan-room reconciliation.

## Credential Recovery Boundary

- Keep the public `recoverCredentialSnapshot(deps)` contract unchanged.
- Extract same-file stages for local-main validation, CookieCloud main recovery, Passport safeAuth main recovery, Yuba completion, and final persistence.
- Preserve all existing messages and early-result semantics so the current contract tests remain authoritative.
- Do not introduce a generic state-machine abstraction or new files.

## Compatibility

- Current-shape config files remain compatible.
- Explicit retired legacy shapes will no longer be converted and may fall back to current defaults.
- No WebUI API shape changes are introduced.
