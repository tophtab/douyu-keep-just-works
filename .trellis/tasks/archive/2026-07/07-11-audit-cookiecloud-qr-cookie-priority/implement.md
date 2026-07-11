# Cookie 权威模型静态审查计划

1. 跟踪正常运行读取路径
   - 确认主站、鱼吧请求只从本地配置取值。
   - 确认 CookieCloud 关闭不会清理本地快照。

2. 跟踪 CookieCloud 写入路径
   - 审查启用时启动同步、cron 同步和手动同步。
   - 记录主站、鱼吧、Passport 各字段的完整性判断与覆盖条件。

3. 跟踪扫码写入路径
   - 审查 Passport、主站、鱼吧分阶段持久化。
   - 检查 CookieCloud 仍开启时后续同步对扫码结果的影响。

4. 跟踪凭证恢复优先级
   - 本地验证、CookieCloud 强制同步、CookieCloud Passport、本地 Passport、safeAuth 和鱼吧 SSO。
   - 检查主站/鱼吧/Passport 是否可能来自不同会话。

5. 检查并发与陈旧写入
   - CookieCloud 启用时后台启动同步与前端手动同步是否重复。
   - 同步远端 fetch 期间扫码更新本地后，旧 resolver 结果是否可能回写覆盖。

6. 检查合同测试
   - 完整/不完整快照覆盖、Passport 保留、扫码分阶段保存。
   - 查找跨来源一致性、同步/扫码竞态和重复同步覆盖缺口。

7. 输出并验证 `audit.md`
   - 每个结论提供 `file:line`。
   - 不包含 Cookie、LTP0、密码、UUID 或 token 值。
   - 运行 `npm run test:contracts`、`git diff --check` 和敏感字段扫描。

## Review Gate

用户确认规划后再进入执行阶段；本任务不会自动实施报告中的建议。
