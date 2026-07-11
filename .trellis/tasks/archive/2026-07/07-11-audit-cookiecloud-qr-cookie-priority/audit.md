# CookieCloud 与本地扫码 Cookie 对接审查

日期：2026-07-11

## 结论

用户的理解是正确的，当前核心模型已经实现，无需修改业务代码：

1. 斗鱼任务始终读取本地持久化快照，不会在每次请求时实时访问 CookieCloud。
2. CookieCloud 开启后负责把云端快照导入本地；关闭后停止同步，但最后保存的本地快照继续使用。
3. 本地快照可以来自 CookieCloud、手填或扫码，运行时不区分历史来源。
4. CookieCloud 数据不完整时，不会覆盖更完整的本地主站或鱼吧快照。

当前 `config/config.json` 中 CookieCloud 处于关闭状态，本地主站、鱼吧和 Passport 快照均存在，因此现在只使用本地快照，不存在 CookieCloud 自动覆盖。

## 实际数据流

### 日常任务

```text
本地 config.json
  ├─ manualCookies.main  ─→ 主站任务
  ├─ manualCookies.yuba  ─→ 鱼吧任务
  └─ manualPassport.cookie ─→ 登录失效时的恢复材料
```

`resolveCookieForUrlFromConfig` 先读取本地主站/鱼吧 Cookie；只有本地为空且 CookieCloud 已启用时才报“请先同步”，不会临时请求 CookieCloud，见 `src/docker/runtime-effective-cookies.ts:44-67`。

### CookieCloud 开启

```text
CookieCloud 远端快照
  → 按 www / yuba / passport 域名提取 Cookie
  → 与当前本地快照比较完整性
  → 写回 manualCookies.main / manualCookies.yuba / manualPassport.cookie
  → 后续任务继续读取本地值
```

CookieCloud 启用时会启动 cron，并立即执行一次启动同步，见 `src/docker/runtime-cookie-cloud-sync.ts:57-90`。手动“同步并校验”先调用 persist 写入本地，再调用只读的本地检查，见 `src/docker/webui/cookie-source-actions.ts:143-175`、`src/docker/webui/cookie-source-actions.ts:206-223`。

### 扫码登录

扫码成功后按顺序写入本地：

1. Passport + 主站成功时立即保存 `manualPassport.cookie` 和 `manualCookies.main`。
2. 鱼吧 SSO 成功后再保存 `manualCookies.yuba`。
3. 如果鱼吧失败，保留之前可用的鱼吧 Cookie，允许稍后重试。

证据见 `src/docker/runtime-passport-qr-login.ts:196-239`、`src/docker/runtime-cookie-snapshot-store.ts:58-80`。

## 实际优先级表

| 场景 | 最终行为 |
| --- | --- |
| CookieCloud 关闭 | 直接使用最后保存的本地快照 |
| CookieCloud 开启但尚未同步，本地已有快照 | 仍使用本地快照 |
| 云端主站完整 | 同步时更新本地主站快照 |
| 云端主站不完整、本地主站完整 | 保留本地主站快照 |
| 云端鱼吧完整 | 同步时更新本地鱼吧快照 |
| 云端鱼吧不完整、本地鱼吧完整 | 保留本地鱼吧快照 |
| 云端 Passport 含 LTP0 | 同步时更新本地 Passport 快照 |
| 云端 Passport 不含 LTP0 | 不传 Passport 更新字段，保留现有本地 Passport |
| 扫码成功 | 扫码结果立即更新本地快照 |
| 扫码后 CookieCloud 仍开启 | 下一次 CookieCloud 同步仍可继续更新本地快照 |

完整性选择逻辑位于 `src/docker/runtime-effective-cookies.ts:70-119`。Passport 只有云端存在 LTP0 时才作为更新写入，见 `src/docker/runtime-effective-cookies.ts:100-108`；未提供 Passport 更新时，partial update 会保留现有值，见 `src/docker/config-store.ts:45-60`。

## 凭证恢复顺序

登录态失败时的顺序也符合“CookieCloud 开启时是更新器”的思路：

1. 先验证当前本地主站 Cookie。
2. 本地无效且 CookieCloud 开启时，强制同步一次 CookieCloud 并验证同步结果。
3. 仍不可用时，Passport 恢复材料优先取 CookieCloud，取不到再使用本地保存的 Passport。
4. safeAuth/鱼吧 SSO 生成的新结果仍只写回本地，不写回 CookieCloud 或浏览器。

证据见 `src/docker/runtime-cookie-recovery.ts:178-193`、`src/docker/runtime-cookie-recovery.ts:396-430`。

这意味着：CookieCloud 开启时，它是优先的外部更新来源；但任何远端或扫码结果最终都必须落成本地快照，任务才会使用。

## 已实现的保护

- 过期 Cookie 在构造 CookieCloud 请求头时会被过滤，见 `src/core/cookie-cloud.ts:243-266`。
- 主站完整性检查要求关键业务字段齐全，鱼吧也有独立完整性检查，见 `src/docker/runtime-effective-cookies.ts:7-8`。
- 不完整云端主站/鱼吧不会降级完整本地值，见 `src/docker/runtime-effective-cookies.ts:75-83`。
- 云端没有 LTP0 时不会清空扫码或手填 Passport。
- CookieCloud 关闭只停止同步，不删除本地 Cookie。
- CookieCloud 的定时同步自身有 `running` 标记，避免两个定时同步重叠，见 `src/docker/runtime-cookie-cloud-sync.ts:15-54`。
- 已有合同测试覆盖 CookieCloud Passport 持久化、不完整云端快照保留本地完整值，以及扫码分阶段持久化，见 `test/douyu-passport-contract.test.js:649-738`、`test/douyu-passport-contract.test.js:740-864`。

## 极端边界，仅供知悉

以下情况代码没有完全建模，但不影响用户确认的正常使用方式，因此本次不建议修改：

1. **不同斗鱼账号混用**：代码只检查字段是否完整，不核对主站、鱼吧和 Passport 是否属于同一账号。如果 CookieCloud 与扫码使用不同账号，可能形成混合快照。正常使用应保证两者是同一个斗鱼账号。
2. **同步和扫码恰好并发**：CookieCloud 拉取需要异步等待；若拉取期间扫码刚好写入本地，最后完成的写入会获胜。不要在点击“同步并校验”的同时进行扫码即可规避。
3. **启用 CookieCloud 时的重复同步**：保存并启用会启动后台首次同步，前端随后也会执行一次手动同步并校验。两次通常读取相同云端数据，结果一致；只是存在重复获取，不会改变权威模型。
4. **扫码结果不是永久压过 CookieCloud**：CookieCloud 仍开启时，未来云端同步可以继续更新本地。这正符合“开启后由 CookieCloud 更新本地”的用户预期；若希望扫码结果固定不再被云端更新，应关闭 CookieCloud。

## 是否需要 single-flight

在这里不需要为了正常 CookieCloud/扫码对接专门增加全局 single-flight：

- 日常任务只读本地，不会同时竞争 CookieCloud。
- CookieCloud 定时同步已有自身运行锁。
- 当前 CookieCloud 关闭，不存在自动同步与扫码竞争。
- 用户确认接受“CookieCloud 开启时继续更新本地”的模型。

全局 single-flight 只对“多个任务同时触发 safeAuth 恢复”或“扫码和手动同步被刻意同时操作”的极端情况有价值，不是当前对接模型成立的前提。

## 最终判断

**当前实现已经符合用户原先的设计思路，可以不改代码。**

最简洁的模型是：

```text
CookieCloud / 手填 / 扫码
          ↓
     本地 Cookie 快照
          ↓
       所有运行时任务
```

CookieCloud 开启与否只决定“它是否继续更新本地”，不会改变“运行时只使用本地快照”这一事实。
