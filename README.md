# douyu-keep-just-works

> 斗鱼粉丝牌 Docker 管理台

[Docker 部署](#docker-部署) · [配置建议](#配置建议) · [致谢](#致谢)

## 简介

![WEBUI预览](./doc/海报.png)

当前仓库主要维护 Docker WebUI，适合 NAS、家庭服务器和长期后台运行场景。

当前支持：

- 荧光棒领取
- 粉丝牌保活
- 双倍任务检测与分配
- 临期荧光棒自动赠送
- 鱼吧签到
- 手填cookie|扫码cookie|cookiecloud同步

## Docker 部署

默认部署使用 GitHub Workflow 发布到 Docker Hub 的镜像。

```yaml
services:
  douyu-keep-just-works:
    image: tophtab/douyu-keep-just-works:latest
    container_name: douyu-keep-just-works
    restart: unless-stopped
    ports:
      - '51417:51417'
    volumes:
      - ./config:/app/config
    environment:
      - TZ=Asia/Shanghai
      - WEB_PASSWORD=password
```

```bash
docker compose up -d
```

启动后访问 `http://localhost:51417`，输入 WebUI 密码后即可在页面中扫码登录、保存 Cookie、启用任务、查看日志和手动触发任务。

查看日志：

```bash
docker compose logs -f
```

## 配置建议

- 推荐优先使用登录页的“扫码登录”。它会通过斗鱼 passport 二维码创建本项目自己的本地登录快照，并按 passport -> 主站 -> 鱼吧的顺序保存。
- CookieCloud 仍可作为浏览器同步兼容路径。它只会把浏览器 Cookie 拉取为本地登录快照；项目不会把刷新后的 Cookie 写回浏览器或 CookieCloud。
- CookieCloud 同步不会用不完整的浏览器快照覆盖已经完整的本地主站或鱼吧快照，除非你手动保存新的 Cookie。
- 手填 Cookie 只作为兜底，适合临时修复登录态或保存独立的 passport Cookie。
- 如果鱼吧签到失败，先检查鱼吧 Cookie 是否仍包含鱼吧登录态，并确认主站 Cookie 仍包含 `acf_uid`、`acf_biz`、`acf_stk`、`acf_ct`、`acf_ltkid`
- 如果主站任务异常，优先检查主站 Cookie 是否仍包含 `acf_uid`、`dy_did`、`acf_stk`

## 理念：it just works

纯vibe coding，能用就行。（出自 Bethesda 游戏工作室总监 Todd Howard）

## 声明

本项目仅供个人学习、技术研究与非商业性技术交流使用，仅提供代码与部署方式参考。

使用者应自行确认其使用行为符合目标平台规则及当地法律法规，作者不对因使用本项目产生的任何直接或间接后果负责。

## 致谢

本项目最初基于 Curtion 的相关实现演进而来，感谢原项目提供的思路与基础：

- [Curtion/douyu-keep](https://github.com/Curtion/douyu-keep)
- [qianfeiqianlan/yuba-check-in](https://github.com/qianfeiqianlan/yuba-check-in)
- [qianjiachun/douyuEx](https://github.com/qianjiachun/douyuEx)
- [starudream/sign-task](https://github.com/starudream/sign-task)
- [每日荧光棒领取的非浏览器模拟方案](https://nicelee.top/blog/2021/09/28/python-douyu-danmu/)
- [LINUX DO 社区](https://linux.do/)
- 给 AI 立规矩的开源框架：[trellis](https://github.com/mindfold-ai/Trellis)
