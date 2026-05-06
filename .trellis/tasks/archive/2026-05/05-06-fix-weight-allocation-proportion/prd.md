# Fix Weight Allocation Proportion Mode

## Goal

Keepalive and expiring-gift `model = 1` allocation must use the same raw-weight proportion semantics as double-card allocation. Weight values are not percentages and do not need to sum to `100`.

## Problem

The current runtime still calls the legacy percentage allocator for keepalive and expiring-gift weight mode, so values such as `1 / 1 / 1` are interpreted as `1% / 1% / remainder` instead of equal weights.

## Requirements

- Keepalive `model = 1` uses total-weight proportion allocation.
- Expiring-gift `model = 1` uses total-weight proportion allocation for each gift group.
- Double-card behavior stays unchanged:
  - checkbox participation filtering remains double-card only;
  - runtime double-active room filtering remains double-card only;
  - fixed-count behavior remains unchanged.
- Persisted payloads keep using the raw `weight` field.
- Do not introduce percentage-based validation or require total weight to equal `100`.
- Add focused tests or equivalent verification covering non-100 total weights for keepalive/expiring allocation if the project has an appropriate test path; otherwise run lint/type-check.

## Acceptance Criteria

- A config with weights `1` and `3` allocates roughly `1:3` instead of `1%:3%:remainder`.
- A config with all positive weights summing below or above `100` is accepted by backend validation.
- Lint and type-check pass.
