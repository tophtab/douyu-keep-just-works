# 说明

[点击这里进行下载](https://github.com/Curtion/douyu-keep/releases)

![img](./doc/home.png)
![img](./doc/config.png)

斗鱼平台自动赠送荧光棒, 支持功能:
1. 模式一：开机自启, 赠送完成后自动关闭
2. 模式二：保持程序运行，定时赠送
3. 赠送数量自定义或者百分比自定义
4. 启动时为托盘模式, 点击托盘按钮显示GUI界面
5. 支持Windows和MacOS

# Docker 部署

适用于 NAS 或服务器环境，无需桌面 GUI。

## 1. 创建配置文件

```bash
mkdir config
cp config.example.json config/config.json
```

编辑 `config/config.json`，填入你的斗鱼 cookie 和房间配置。配置包含两套独立机制：

- `collectGift` — 独立领取任务，按 cron 定时领取荧光棒
- `keepalive` — 保活任务，定时赠送荧光棒防止亲密度掉落
- `doubleCard` — 双倍亲密度检测，按勾选房间检测双倍卡并在命中时赠送
- `ui.themeMode` — WebUI 主题模式：`light` / `dark` / `system`

三套机制互相独立并行运行。领取任务只负责领取，不再作为保活或双倍执行前的隐藏步骤。可以只配置其中任意一个。

## 2. docker-compose.yml

```yaml
version: '3.8'

services:
  douyu-keep:
    image: curtion/douyu-keep:latest
    container_name: douyu-keep
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ./config:/app/config
    environment:
      - TZ=Asia/Shanghai
```

`latest` 表示当前默认分支构建的最新版。
如果你想固定在一个稳定大版本线，也可以改成类似 `curtion/douyu-keep:1.1` 这样的 minor 版本标签。

## 3. 启动

```bash
docker compose up -d
```

打开浏览器访问 `http://localhost:3000` 即可通过 WebUI 管理配置、查看日志和手动触发任务。

> 如果没有预先创建 `config.json`，也可以启动后直接在 WebUI 中配置。

查看日志：

```bash
docker compose logs -f
```

## 4. 配置说明

| 字段 | 说明 |
|------|------|
| `cookie` | 斗鱼登录 cookie，需包含 `acf_uid`、`dy_did`、`acf_stk` 等字段 |
| `ui.themeMode` | WebUI 主题模式：`light`、`dark`、`system` |
| `collectGift.cron` | 领取任务的 cron 表达式（6位，含秒），默认 `0 10 0,1 * * *` 表示每天 00:10 和 01:10 各尝试一次 |
| `keepalive.cron` | 保活任务的 cron 表达式（6位，含秒），默认 `0 0 8 */6 * *` 表示每 6 天的 08:00 执行一次 |
| `doubleCard.cron` | 双倍检测的 cron 表达式，默认 `0 0 14,16,20 * * *` 表示每天 14:00、16:00、20:00 执行 |
| `model` | 分配模式：`1` 按百分比，`2` 按固定数量（保活默认是固定数量，`number: -1` 表示剩余全部） |
| `send` | 房间配置，key 为房间号 |
| `doubleCard.enabled` | 双倍任务勾选状态，`true` 表示该房间参与双倍检测与赠送候选集 |

## 5. WebUI 管理面板

Docker 版内置 Web 管理面板（端口 3000），支持：

- **概览页** — 首页保留登录/领取/保活/双倍的基础开关状态，并直接展示粉丝牌列表
- **独立栏目** — 左侧拆分为概览、登录与领取、保活任务、双倍任务、运行日志
- **独立领取任务** — 领取荧光棒拥有单独 cron、单独状态和手动触发入口
- **粉丝牌驱动同步** — 保活和双倍都围绕同一份粉丝牌列表同步配置，不再手动导入保活房间
- **状态归位** — 登录状态与领取状态放在“登录与领取”页，保活/双倍状态分别放回各自页面
- **保活自动补位** — 粉丝牌列表新增或减少时，保活配置自动增删房间；旧房间保留原分配，新房间按模式默认填入 `1` 或 `1%`
- **双倍勾选持久化** — 双倍配置保留独立 cron / 分配逻辑，并按房间记录是否参与检测与赠送
- **Cron 预览** — 每个任务页都会展示 cron 表达式未来三次执行时间
- **统一上海时区** — 页面展示时间和 Docker 调度都统一按 `Asia/Shanghai`
- **主题模式** — 支持浅色、深色和跟随系统
- **运行状态** — 实时查看领取/保活/双倍卡任务状态、上次执行和下次执行时间
- **日志查看** — 滚动查看最近日志，支持清空
- **手动触发** — 一键手动执行领取、保活或双倍卡任务

可通过 `WEB_PORT` 环境变量修改端口（默认 3000）。

# 开发

升级: `yarn up`. 禁止升级chalk, 保持V4.1.2版本

## WSL 本地开发与验证

如果你在 WSL 里做日常开发、编译检查或后续测试验证，可以直接走本地 Node 环境，不需要先起 Docker。

1. 切到项目推荐的 Node 版本

```bash
nvm install
nvm use
```

如果你的 WSL 里还没有 `nvm`，也可以先确认 `node -v` 为 18.x，再继续。

2. 安装依赖

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci --ignore-scripts
```

这样可以避免安装阶段额外下载 Chromium，更适合 WSL 里的日常校验环境。

3. 运行本地验证

```bash
npm run verify:wsl
```

这个命令会直接在 WSL 内完成：

- Renderer/Main 代码编译
- Docker runtime TypeScript 编译

它不会打 Linux 安装包，因此不依赖 Docker，也不要求系统先装 `rpm`。

4. 本地开发模式

```bash
npm run dev
```

5. 如果你确实需要在 WSL 里跑完整 Linux 打包

```bash
sudo apt-get update
sudo apt-get install -y rpm
npm run build
```

`npm run build` 会走 `electron-builder`，生成 Linux 安装包；这一步不是日常验证必需。

## 通用开发

1. `yarn` 或 `npm` 安装依赖
2. `yarn dev` 或 `npm run dev` 开发模式

# 打包

1. `yarn build:win` 或 `npm run build:win`
2. `yarn build:mac` 或 `npm run build:mac`
3. `yarn build:linux` 或 `npm run build:linux`
