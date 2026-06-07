# Douyu Pocket and Double-Card Contracts

> Observed contracts for Douyu anchor pocket items and active intimacy multiplier cards.

---

## Scenario: Glow-Stick Double-Card Detection

### 1. Scope / Trigger

- Trigger: changing glow-stick double-card detection, active room filtering, intimacy multiplier interpretation, or gift-scope behavior in `src/core/double-card.ts`, `src/core/double-card-job.ts`, or related tests.
- Scope: Douyu `anchorPocket` and `effective` pocket APIs used to decide whether sending glow sticks should be delayed until a useful intimacy multiplier is active.
- Source status: these are live API observations from June 7, 2026, not official Douyu documentation. Re-check the APIs before broadening accepted card types.

### 2. Signatures

- Anchor pocket card inventory:
  - `GET https://www.douyu.com/japi/interact/cdn/pocket/anchorPocket?rid=<roomId>`
  - Important response path: `data.list[]`
- Active card state:
  - `GET https://www.douyu.com/japi/interact/cdn/pocket/effective?rid=<roomId>`
  - Important response path: `data.list[]`
- Current implementation entry point:
  - `checkDoubleCard(roomId: number, cookie: string) -> Promise<DoubleCardInfo>`

### 3. Contracts

- `rid` is the room id.
- `pid` identifies the concrete prop/card. Prefer `pid` over `name` when distinguishing specific cards.
- `type` identifies the card category. `anchorPocket` and `effective` use the same `pid/type/name` semantics for observed double-card records.
- `anchorPocket` returns full card definitions, including `intro` and usually `ext`.
- `effective` returns active-card records. It includes `pid`, `type`, `name`, `tid`, `ctime`, and `expireTime`, but observed active records do not include `ext`.
- `ext.multiple` is an integer percentage. `200` means 2x, `250` means 2.5x.
- `ext.limitFactor` is an integer percentage for the daily intimacy cap, not the per-gift multiplier. `300` means the cap is 3x, not that gifts earn 3x.
- Observed card categories:

| type | Observed meaning | Glow-stick handling |
|---:|---|---|
| `1` | Silver, gold, and diamond room-wide intimacy double cards | Count as useful for glow sticks |
| `2` | Traffic support cards | Do not count as intimacy multipliers |
| `22` | Diamond-fan carnival card | Do not count for normal glow-stick users |
| `24` | Double-card fragment | Do not count as active multiplier |
| `30` | Fan badge entitlement card | Do not count as intimacy multiplier |
| `32` | Ordinary-gift double card | Do not count for glow sticks |
| `36` | Fan badge level-cap upgrade card | Do not count as intimacy multiplier |

- Observed intimacy-related cards:

| name | pid | type | multiple | limitFactor | Applicability |
|---|---:|---:|---:|---:|---|
| Silver double card | `8`, `422` | `1` | `200` | `200` | Room-wide, ordinary users included |
| Gold double card | `7` | `1` | `200` | `300` | Room-wide, ordinary users included |
| Diamond double card | `6`, `432` | `1` | `200` | `400` | Room-wide, ordinary users included |
| Diamond-fan carnival card | `431` | `22` | `250` | `400` | Diamond-fan users only |
| Iron-skin gift double card | `482` | `32` | `200` | `200` | Gift-panel ordinary gifts or diamond-fan opening only |

- For glow-stick jobs, treat only active `effective` records with `type === 1` and a future `expireTime` as useful double-card state.
- Do not treat `type === 22` as useful for normal glow-stick sending. Its `intro` says the 2.5x multiplier applies to diamond-fan users.
- Do not treat `type === 32` as useful for glow sticks. Its `intro` says it applies to gift-panel ordinary gifts or diamond-fan opening and excludes backpack props. Glow sticks use prop/backpack donation behavior (`propId: 268`), so they are not a safe match for ordinary gift cards.

### 4. Validation & Error Matrix

- `effective.error !== 0` -> no trusted active-card state; surface the API failure through the existing error path.
- `effective.data.list` missing or empty -> no active double-card room.
- Active record has `type !== 1` -> ignore for glow-stick double-card detection, even if `name` contains double-card wording.
- Active record has `type === 1` but `expireTime` is missing, non-numeric, or not in the future -> ignore as inactive or malformed.
- `anchorPocket` says a card has `multiple > 200` but its `intro` limits the user group or gift type -> do not promote it into glow-stick detection without proving glow sticks and the current user class are eligible.
- `type === 2` observed in `anchorPocket` -> traffic card, not a double-card detection target.

### 5. Good/Base/Bad Cases

- Good: a room has an active diamond double card in `effective` with `type: 1`, `pid: 6`, and a future `expireTime`; glow-stick double-card logic marks the room active.
- Good: a room has only a diamond-fan carnival card in `effective` with `type: 22`; glow-stick double-card logic leaves the room inactive for normal glow-stick sending.
- Good: a room has only an iron-skin gift double card in `effective` with `type: 32`; glow-stick double-card logic leaves the room inactive.
- Base: `anchorPocket` contains a gold double card with `multiple: 200` and `limitFactor: 300`; code treats the multiplier as 2x and does not infer a 3x per-gift multiplier.
- Bad: broadening detection to any active record whose `name` contains `双倍`.
- Bad: treating `type: 2` as a double-card type because a local variable or UI mode says `type2` or `model: 2`.
- Bad: treating `limitFactor: 400` as a 4x glow-stick earning multiplier.

### 6. Tests Required

- `checkDoubleCard` tests should assert `type: 1` plus a future numeric `expireTime` returns active.
- Tests should assert expired `type: 1` records return inactive.
- Tests should assert `type: 22`, `type: 32`, and `type: 2` records return inactive for glow-stick double-card detection.
- Tests should include at least one malformed record with missing or non-numeric `expireTime`.
- Contract tests should preserve the distinction between Douyu card `type` values and project allocation `model` values.

### 7. Wrong vs Correct

#### Wrong

```typescript
const active = list.some(item => item.name.includes('双倍'))
```

#### Correct

```typescript
const active = list.some(item =>
  item.type === 1
  && typeof item.expireTime === 'number'
  && item.expireTime > now
)
```

#### Wrong

```typescript
// Diamond-fan and ordinary-gift cards are also multipliers, so include them.
const activeTypes = new Set([1, 22, 32])
```

#### Correct

```typescript
// Glow sticks are backpack props, and normal users do not get diamond-fan-only 2.5x.
const activeTypesForGlowSticks = new Set([1])
```
