# douyu-keep-just-works

> 斗鱼自动赠送荧光棒续牌，docker版

[Docker 部署](#docker-部署) · [WebUI 管理面板](#webui-管理面板) · [配置参数](#配置参数) · [桌面版](#桌面版)

## 简介

![WEBUI预览](./doc/海报.png)

当前仓库主要维护 Docker WebUI，适合 NAS、家庭服务器和长期后台运行场景。

它解决的事情很直接：

- 粉丝牌保活
- 荧光棒领取
- 双倍任务检测与分配

核心特点：

- 领取、保活、双倍任务拆分独立
- 支持 cron 定时执行和手动触发
- Docker WebUI 可直接查看状态、改配置、看日志
- 保留已保存配置，不因开关停用而清空

## Docker 部署

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
      - WEB_PASSWORD=password    # webui登录密码,部署前修改
```

```bash
docker compose up -d
```

启动后访问 `http://localhost:51417`，先输入 WebUI 密码，再通过管理台填写配置、查看日志和手动触发任务。

```bash
docker compose logs -f
```

## WebUI 管理面板

- 概览页直接查看登录、领取、保活、双倍等状态
- 登录、领取、保活、双倍、日志分栏管理
- 领取任务拥有独立 cron、独立状态和单独手动触发入口
- 保活与双倍围绕同一份粉丝牌列表自动同步
- 支持按房间勾选双倍、权重预览和未来执行时间展示
- 支持主题切换、实时日志和 WebUI 密码登录

## 配置参数

| 字段 | 说明 |
|------|------|
| `cookie` | 斗鱼登录 cookie，需包含 `acf_uid`、`dy_did`、`acf_stk` 等字段 |
| `ui.themeMode` | WebUI 主题模式：`light`、`dark`、`system` |
| `collectGift.active` | 是否启用领取任务；关闭后保留 cron 配置，但不会参与调度 |
| `collectGift.cron` | 领取任务 cron（6 位，含秒），默认 `0 10 0,1 * * *`，表示每天 00:10 和 01:10 各尝试一次 |
| `keepalive.active` | 是否启用保活任务；关闭后保留房间配置与 cron，但不会参与调度 |
| `keepalive.cron` | 保活任务 cron（6 位，含秒），默认 `0 0 8 */6 * *`，表示每 6 天的 08:00 执行一次 |
| `keepalive.model` | 保活分配模式：`1` 按百分比，`2` 按固定数量；保活默认固定数量，只有一个房间可配置 `number: -1` 表示领取剩余全部，未配置 `-1` 时多余荧光棒会保留 |
| `doubleCard.active` | 是否启用双倍任务；关闭后保留勾选和分配设置，但不会参与调度 |
| `doubleCard.cron` | 双倍检测 cron，默认 `0 20 14,17,20,23 * * *`，表示每天 14:20、17:20、20:20、23:20 执行 |
| `doubleCard.model` | 双倍分配模式：`1` 按权重，`2` 按固定数量；按权重时不要求总和等于 `100` |
| `send` | 房间配置，key 为房间号；`model = 1` 时内部使用 `weight` 字段存储权重值 |
| `doubleCard.enabled` | `true` 表示该房间会参与双倍检测与赠送候选集，`false` 表示保留配置但本轮不参与 |

### Docker 环境变量

| 字段 | 说明 |
|------|------|
| `WEB_PASSWORD` | Docker WebUI 登录密码，默认示例值为 `password` |
| `TZ` | 容器时区，建议保持 `Asia/Shanghai` |

## 项目理念

取自 Todd Howard 的 `It just works.`。

vibe coding，it just works。

## 桌面版

如果你需要桌面版，请前往：

- https://github.com/Curtion/douyu-keep

## 项目历史

本项目最初基于 Curtion 的相关实现演进而来，当前独立维护 Docker WebUI 方向。
