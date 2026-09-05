# Douyu Fan Intimacy: Deferred Cap Research

> Recorded: 2026-09-05. Status: **Deferred by user decision; not implemented**.
> This is an integration research record, not an enabled runtime contract or an
> instruction to resume the feature. Upstream behavior may change.

## 1. Scope / Trigger

Read before working on daily fan-badge intimacy limits, cap-aware double-card
allocation, pre-send checks, or authenticated Douyu WebSocket connections.

### Design decision: viewing experience takes priority

The proposed feature would check each badge's remaining daily intimacy before
allocating or sending gifts. A second authenticated connection interrupted the
original viewing page during investigation. The user therefore shelved the
feature. Do not add cap polling, reconnect loops, a persistent cap socket, browser
automation, a browser extension/bridge, new configuration, or gift-allocation
changes without an explicit request to resume.

The project has a Node HTTP/WebSocket backend and a Vue management WebUI; it does
not run a Douyu browser page. Playwright was only an investigation tool. A browser
bridge/userscript would be a new external component, not existing infrastructure.

### Evidence and privacy boundaries

- **Observed** below means recorded results from the preceding live investigation,
  not tests repeated while writing this document.
- **Source-derived** means official frontend or local project code evidence;
  it does not establish all server-side timing or accounting behavior.
- **User-reported** behavior and **unverified** ideas are identified separately.
- Private local inputs: `.temp/www.douyu.com.har` and
  `.temp/MedalPanel_919c2cc_147b564.js`. `.temp/` and `.playwright-cli/` are ignored
  and untracked. These files are not required to understand this record.
- Keep only field names, placeholders, and reduced numeric observations in
  shared documentation. Never copy raw HARs, cookies, login packets, tokens,
  account identifiers, device IDs, or CookieCloud connection credentials.

## 2. Signatures

### WebSocket transports and message family

| Transport / message | Evidence and purpose |
|---|---|
| `wss://wsproxy.douyu.com:6675` | Observed authenticated room connection carrying personal `blst` data; ports `6671` and `6672` were also observed |
| `wss://wsproxy.douyu.com:6672` | Existing project's gift-collection connection; not a newly implemented cap reader |
| `wss://danmuproxy.douyu.com:8501` | Separate chat connection family; `8503` and `8505` also observed; personal badge snapshot was captured on `wsproxy`, not this transport |
| `loginreq` / `loginres` | Authentication request / response |
| `blst` | **Live-confirmed** badge-list snapshot, with multiple owned badges |
| `synfim`, `synfimd` | Source-derived badge synchronization family; do not assume unconditional post-login delivery or proven gift-delta semantics |
| `gbi`, `obres` | Related badge messages found in frontend investigation; not required for the confirmed snapshot path |

There is no verified standalone HTTP endpoint returning the final personal daily
cap in this investigation. This is not proof that no such HTTP endpoint exists.

### HTTP endpoints inspected or referenced

Main-site base URL: `https://www.douyu.com`. Use the existing main-site cookie
resolver and `makeHeaders(cookie, ...)` for requests that require authentication.
`<room-id>` and `<current-user-id>` below are placeholders, not literal arguments.

| Method and path | What it provides / limitation |
|---|---|
| `GET /member/cp/getFansBadgeList` | HTML badge table; `getFansList()` parses today's earned intimacy from column 4. No separate cap field was identified |
| `GET /japi/prop/backpack/web/v5?rid=<room-id>` | Gift metadata including per-gift `intimate`; glow stick `268` sampled as `intimate=1`. Not the daily cap |
| `GET /japi/interact/cdn/pocket/effective?rid=<room-id>` | Active room double-card state, not the final personal daily cap |
| `GET /japi/interactnc/web/fans/userRoomBuffInfo?rid=<room-id>` | Buff response `{error:0,msg:"ok",data:{fab,flb}}`, not the final cap |
| `GET /japi/interactnc/web/fans/userTaskList?rid=<room-id>&uid=<current-user-id>` | Daily/weekly tasks and intimacy rewards, not a verified personal-cap source |
| `GET /japi/interact/cdn/superfans/queryFansLvlUpper?rid=<room-id>` | Badge **level** ceiling, e.g. `{level:37,upperOpen:1}`, not daily intimacy |
| `POST /member/prop/send` | Actual current project gift-send endpoint; mutating, never use as a cap probe |
| `/japi/prop/donate/mainsite/v1` | Community/GLM report lead, not this project's current send path or a verified cap source |

### Existing project entry points

- [collect-gift.ts](../../../src/core/collect-gift.ts):
  `collectGiftViaDanmu(cookie: string, roomId: number | string): Promise<void>`.
  It authenticates and then sends **`h5ckreq` to collect gifts**; do not invoke it
  merely to read a cap. Its private framing/login helpers are reference material,
  not a validated reusable cap-client API.
- [api.ts](../../../src/core/api.ts): `makeHeaders`, `getCookieValue`,
  `getFansList`, backpack calls, and `sendGift`.
- [runtime-effective-cookies.ts](../../../src/docker/runtime-effective-cookies.ts)
  and [runtime-cookie-source.ts](../../../src/docker/runtime-cookie-source.ts):
  existing cookie selection/recovery ownership; do not add a second CookieCloud
  client or copy secrets into a standalone checked-in script.
- [double-card-job.ts](../../../src/core/double-card-job.ts),
  [gift.ts](../../../src/core/gift.ts), and
  [job-gift-utils.ts](../../../src/core/job-gift-utils.ts): future allocation/send
  review points only. Their behavior is unchanged by this record.

## 3. Contracts

These are observed wire shapes and future safety requirements, **not implemented
cap-query guarantees**.

### Authentication and invocation outline

The existing Node collector sends handshake headers `Cookie`, `User-Agent`,
`Origin: https://www.douyu.com`, and `Referer: https://www.douyu.com/<room-id>`.
Login material must come from one fresh, coherent main-site snapshot.

| Cookie name | `loginreq` field | Evidence |
|---|---|---|
| `acf_username` | `username` | Existing collector and browser flow |
| `acf_ltkid` | `ltkid` | Existing collector and browser flow |
| `acf_biz` | `biz` | Existing collector and browser flow |
| `acf_stk` | `stk` | Existing collector and browser flow |
| `acf_ct` | `ct` | Existing collector and browser flow |
| `acf_dmjwt_token` | `jwt` | Observed browser login; not added by current collector |

Other fields include `type=loginreq`, `roomid`, `password=""`, `devid`, `rt`
(Unix seconds), `pt=2`, `vk`, `ver`, `aver`, and browser metadata. The existing
`buildLoginPacket` computes `vk = md5(rt + DOUYU_LOGIN_VK_SECRET + devid)`; refer
to that source constant instead of duplicating it. Its `randomDeviceId` is not
evidence that a different device ID prevents session interruption.

Observed browser versions were `ver=20220825`, `aver=218101901`; the existing
collector uses `ver=20180222`, `aver=219032101`. Do not assume the two login
builders are equivalent or that the legacy one is already verified for caps.
The generic GLM description using an `auth_wl` password is not the observed
browser/current-project recipe.

If the user explicitly resumes this investigation and accepts session effects:

1. Resolve current main-site cookies through the existing resolver, without
   logging them or altering cookie-source authority.
2. Open one authenticated `wsproxy` connection; send a correctly framed
   `loginreq` and validate `loginres`. A WebSocket `open` event alone does not
   establish account authentication. The collector checks `roomgroup@=1`, but
   the cap reader's authentication checks still need dedicated validation.
3. Await and decode `blst`; select the badge by its `rid`, not the currently
   viewed room or first list entry. The observed list included other rooms;
   completeness/pagination across all badges is still unverified.
4. Extract only whitelisted numeric fields and record account-scoped identity
   internally plus room, observation time, and source; do not persist raw frames.
5. Close the connection and clear timers on success, error, or bounded timeout.
   Do not send `h5ckreq`, call `sendGift`, use test gifts, or start reconnect loops.

Authentication itself is **not passive with respect to the viewing session**.
This outline is not an instruction to run it while the feature is deferred.

### STT framing and nested badge lists

- STT key/value form: `key@=value/`; escape `@` as `@A` and `/` as `@S`.
- Binary frame: two equal uint32 little-endian lengths, uint16 little-endian
  message code (`689` client, `690` received), two flag bytes, UTF-8 payload with
  terminating NUL. With NUL included in payload bytes, length is
  `payloadBytes + 8`; total frame bytes are `length + 4`.
- Current `encodeDouyuMessage` adds a NUL and `generateDouyuPacket` adds another.
  Record this discrepancy; do not silently fix the collector as part of research.
  Fixture tests are needed before extracting a shared encoder.
- Current `decodeDouyuMessages` scans `type@=...\0` with a regex. A future parser
  must validate frame lengths and handle buffered/concatenated packets, Unicode,
  and nested escaping rather than treating all socket bytes as flat text.

Reduced, non-replayable `blst` structure (other fields omitted):

```text
type@=blst/wf@=2/list@=rid@AA=84452@ASafim@AA=600000@ASmafim@AA=600000@AS@Srid@AA=60937@ASafim@AA=600000@ASmafim@AA=600000@AS@S/
```

Decode one nesting layer at a time. Global recursive unescaping before splitting
destroys list/record boundaries. `wf=2` was observed; no completeness semantics
have been established for it.

### Badge fields and UI units

| Field | Meaning / evidence limit |
|---|---|
| `rid`, `bnn`, `bl` | Badge room ID, name, and level |
| `fim` | Cumulative intimacy |
| `nfim` | Next-level cumulative threshold, **not** remaining experience; matches the panel denominator |
| `afim` | Today's earned intimacy |
| `mafim` | Today's actual cap matching the medal panel in the observed finite-cap cases |
| `tf` | Frontend uses `tf > 0` for unlimited-cap display; positive branch not live-tested |
| `eofim` | Overflow-related field; exact accounting not validated with gifts |
| `mbl` | Badge level ceiling, not daily intimacy ceiling |

Frontend conversions found during source inspection:

```javascript
fim: parseInt(`${rt.fim / 10}`, 10) / 10
nfim: Math.round(rt.nfim / 10) / 10
mafim: Math.round(rt.mafim / 10) / 10
afim: Math.round(rt.afim / 10) / 10
```

The effective scale is approximately **raw / 100**, with the shown rounding,
not raw / 10. Keep raw integer units for any future budget arithmetic; round only
for display. `mafim` already matches the actual displayed cap in these samples;
do not multiply it by `fab`, `flb`, or a guessed base cap.

Historical samples from the investigation, **not fixed business limits**:

| Room | Level | `afim` raw | `mafim` raw | UI today / cap | `fim` / `nfim` raw |
|---|---:|---:|---:|---|---|
| 217331 | 9 | 200000 | 200000 | 2000 / 2000 | 422070 / 434000 |
| 60937 | 11 | 600000 | 600000 | 6000 / 6000 | 723150 / 1000000 |
| 84452 | 14 | 600000 | 600000 | 6000 / 6000 | 2175280 / 2744000 |

All sampled `tf` values were zero. Direct medal-panel checks showed cap `6000`
and experience `7231.5/10000` in room 60937, and cap `6000` and experience
`21752.8/27440` in room 84452. These values do not establish the account's cap at
another time, in another room, or under other active privileges.

An earlier retained HAR also contains a finite-cap `blst` sample for room
71415: `bl=21`, `afim=250`, `mafim=250000`, and `tf=0`. The recorded cap converts
to UI `2500`, consistent with the user's separate report of seeing a `2500`
cap. This sample was recovered by an offline read of the existing capture;
it is not a new live observation or proof of the exact time of the user's UI
report. Do not treat it as a current cap or a universal base limit.

To find the relevant UI during a future authorized check, click
`.FansMedalEnter-enterContent` and inspect `.FansMedalPanel-OwnerInfo` for the
current room's daily-cap text. Selectors may change. Unrelated activity text such
as a star challenge's `5209/6000` is not intimacy evidence.

### Buff data is separate, not a complete cap formula

| Room | Observed `userRoomBuffInfo.data` | Other observed UI | Displayed cap |
|---|---|---|---:|
| 217331 | `{fab:300,flb:200}` | Fanclub iframe: 3x gain, 2x limit | 2000 |
| 60937 | `{fab:300,flb:400}` | Room banner: 2x intimacy + 4x cap | 6000 |
| 84452 | `{fab:300,flb:400}` | Room banner: 2x intimacy + 3x cap | 6000 |

These different UI surfaces do not establish an exact stacking formula. Neither
`flb * 1000` nor `mafim * fab` is a validated calculation. The exact effective
per-gift gain under concurrent buffs also remains unverified. Keep the existing
[double-card detection contract](./contracts.md#glow-stick-double-card-detection)
separate from this research.

### Observed session interruption and limits of the test

- A logged-in Playwright viewing page in room 84452 was kept open while a
  second connection reused its captured authenticated login frame.
- Both a browser duplicate and an independent Node `ws` client were tried. The
  Node client approximated the backend transport; **no deployed Docker container
  was tested** and it reused the browser frame, not a proven fresh cap-client
  login builder.
- After the second connection, the original page's `wsproxy:6675` and
  `danmuproxy:8505` recorded close code `1006`, empty reason, `wasClean=false`.
  This supports an interruption risk; `1006` is a generic abnormal close, not a
  documented duplicate-login business code.
- A controlled different-device-ID test was unfinished and inconclusive. The
  user separately reported mutual kicking across browsers and PC/mobile, and
  asked not to pursue the different-device branch further.
- Automatic browser recovery is not guaranteed seamless. A persistent Docker
  socket or random device ID is not a demonstrated workaround.
- Test browser connections were cleaned up; no gifts were sent. Existing
  `collectGiftViaDanmu` uses related authenticated transport and is an audit
  candidate, but was not independently verified by this interruption test and
  was not changed or disabled.

Secondary research leads from the user-provided GLM report were
[qianjiachun/DouyuEx](https://github.com/qianjiachun/DouyuEx) and
[Curtion/douyu-keep issue 12](https://github.com/Curtion/douyu-keep/issues/12).
They were not independently reverified during documentation and are not primary
proof of the cap source. The GLM-referenced `research/douyu_intimacy/FINDINGS.md`
is not present locally; this document is the maintained repository record.

## 4. Validation & Error Matrix

Future cap-aware behavior must be designed and tested explicitly; nothing below
changes current gift handling.

| Condition | Required treatment if work resumes |
|---|---|
| Feature still deferred | No new cap connection, schedule, browser component, or send-path change |
| Socket opens but login is unverified, login fails, or cookie snapshot is incomplete | No trusted cap; do not log credentials or start a competing credential-refresh flow |
| Timeout, early close, or `1006` | Return an unavailable result and clean up; no automatic reconnect loop |
| Requested `rid` absent, account mismatch, malformed/negative/non-finite/unsafe integer values | No valid cap for that room; do not substitute the first badge or a guessed/default limit |
| Valid finite-cap badge with `tf=0` | Candidate remaining raw budget is `max(0, mafim - afim)` |
| `afim >= mafim` with a valid finite cap | Remaining budget is zero, including already-over-cap snapshots |
| `tf > 0` | Treat as a separate source-derived unlimited branch pending validation; never infer unlimited from missing values |
| Effective gift gain is unknown | Cap alone cannot safely determine a partial gift count; do not invent a multiplier formula |
| Stale snapshot, account switch, Shanghai day rollover, concurrent manual gifts, or overlapping jobs | Invalidate/revalidate the budget; do not claim a race-free guarantee from a one-time query |
| Multiple gift groups or failed-count transfer to another room | Share room budgets and revalidate the destination before sending; any redesign requires approval |

The current [task-local DID contract](./contracts.md#task-local-room-did-reuse)
preserves failed-count carry-over in `sendGifts`. A future cap-aware redesign must
address that transfer deliberately; it must not silently change it now. Unknown
or expired data must not become a guessed cap or implicit permission to send.

## 5. Good/Base/Bad Cases

- **Good (now):** preserve this record and leave runtime/configuration unchanged
  while the feature is shelved.
- **Base (future offline fixture):** select room 84452 from a multi-badge `blst`,
  interpret raw `600000` as UI `6000`, and compute zero remaining raw budget when
  `afim` equals `mafim`.
- **Bad:** start background authenticated queries during viewing, read unrelated
  `6000` UI text, assume every room has the same cap, or use a test gift to discover
  the cap without explicit authorization.

## 6. Tests Required

These are **future assertion points**, not tests implemented or passed by this
documentation change. Use synthetic/sanitized offline fixtures, never live user
cookies in CI.

- Framing: lengths, codes, terminating NUL, Unicode, buffered/concatenated frames,
  and nested `@A`/`@S` list decoding preserve exact room/record boundaries.
- Numeric behavior: raw `600000` maps to UI `6000`; threshold vs remaining
  experience stays distinct; finite zero/over-cap budgets and source-derived
  unlimited state are handled separately from missing/malformed fields.
- Isolation: multi-badge selection, absent rooms, account changes, stale data,
  Shanghai date rollover, shared budgets across groups/jobs, and externally
  consumed budget cannot silently reuse another room/day/account's allowance.
- Lifecycle: mocked login failure, timeout, and `1006` release sockets/timers;
  no retry loop, `h5ckreq`, gift send, secret logging, or raw-frame persistence.
- Allocation, if authorized: verify effective gain units/stacking first, then
  assert whole-gift rounding and destination-budget revalidation after failed
  quantities carry over. A live socket test needs explicit agreement about the
  viewing interruption risk; do not include it in routine verification.

## 7. Wrong vs Correct

| Wrong | Correct |
|---|---|
| "The feature is finished because the interface was found" | Research recorded; cap-aware sending is deferred and unimplemented |
| "Use `danmuproxy:8501` and `synfim` always arrives after login" | Personal snapshot was observed as `blst` on authenticated `wsproxy`; other delivery guarantees are unverified |
| "Raw `600000` means UI `60000`" | Apply the frontend's approximately `/100` conversion: UI `6000` |
| "`nfim` is remaining XP; `mbl` is today's cap" | `nfim` is a cumulative level threshold; `mbl` is a level ceiling; `mafim` is the observed daily cap |
| "Combine buff endpoints to derive a universal final cap" | Prefer the observed final `mafim` when a future authorized source is available; stacking is unresolved |
| "Reading a cap cannot affect the viewing session" | The authenticated login can interrupt it even without sending gifts |
| "Call `collectGiftViaDanmu` as a query helper" | It sends `h5ckreq`; only inspect/reuse validated protocol pieces in a separately authorized design |
| "Commit the HAR/login frame for reproducibility" | Keep captures ignored; preserve only sanitized contracts and fixtures |
