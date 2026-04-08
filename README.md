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

- `keepalive` — 保活任务，定时赠送荧光棒防止亲密度掉落
- `doubleCard` — 双倍亲密度检测，检测到双倍卡才赠送，否则攒着

两套机制各自有独立的 cron 和房间配置，并行运行。可以只配置其中一个。

## 2. docker-compose.yml

```yaml
version: '3.8'

services:
  douyu-keep:
    image: curtion/douyu-keep:latest
    container_name: douyu-keep
    restart: unless-stopped
    volumes:
      - ./config:/app/config
    environment:
      - TZ=Asia/Shanghai
```

## 3. 启动

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

## 4. 配置说明

| 字段 | 说明 |
|------|------|
| `cookie` | 斗鱼登录 cookie，需包含 `acf_uid`、`dy_did`、`acf_stk` 等字段 |
| `keepalive.cron` | 保活任务的 cron 表达式（6位，含秒），如 `0 0 8 * * *` 表示每天8点 |
| `doubleCard.cron` | 双倍检测的 cron 表达式，如 `0 0 */4 * * *` 表示每4小时 |
| `model` | 分配模式：`1` 按百分比，`2` 按固定数量（`number: -1` 表示剩余全部） |
| `send` | 房间配置，key 为房间号 |
| `time` / `timeValue` | 可选，限制赠送日期（仅 keepalive 支持） |

# 开发

升级: `yarn up`. 禁止升级chalk, 保持V4.1.2版本

1. `yarn` 安装依赖
2. `yarn dev` 开发模式

# 打包

1. `yarn build:win`
2. `yarn build:mac`
3. `yarn build:linux`