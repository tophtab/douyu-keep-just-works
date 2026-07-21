# 发布 3.10.0

## Goal

将 `v3.9.0` 之后已经合入 `master` 的改动作为 `3.10.0` 正式发布，确保版本元数据、变更记录、Git 标签、Docker 镜像和 fnOS 安装包一致且可验证。

## Background

- 当前 `master` 与 `origin/master` 同步，发布前版本为 `3.9.0`，最新正式标签为 `v3.9.0`。
- `v3.9.0..master` 的用户可见改动包括登录 Cookie 字段顺序调整，以及配置合同收敛与旧配置迁移。
- 仓库以小写 `vX.Y.Z` 标签触发正式发布；tag workflow 会生成 amd64/arm64 Docker 镜像、multi-arch manifest，并将 fnOS FPK 与 SHA256 文件上传到 GitHub Release。
- canonical 配置写回是单向迁移；README 已要求升级前备份 `config/config.json`，回滚旧镜像时同时恢复备份。

## Requirements

- 将 `package.json` 和 `package-lock.json` 的项目版本更新为 `3.10.0`。
- 在 `CHANGELOG.md` 中新增日期为 `2026-07-21` 的 `3.10.0` 条目，准确概括 `v3.9.0..master` 的用户可见变化，并保留空的 `Unreleased` 区段。
- 不引入与发布无关的业务、配置或 UI 改动，不改写已有 `v3.9.0` 标签。
- 发布准备必须通过项目质量检查，并提交到 `master`。
- 创建并推送带说明的 `v3.10.0` 标签，等待正式发布 workflow 完成。
- 核对远端标签、Docker 发布流程和 GitHub Release 资产与 `3.10.0` 一致。

## Acceptance Criteria

- [x] `package.json` 与 `package-lock.json` 均声明版本 `3.10.0`。
- [x] `CHANGELOG.md` 包含 `## 3.10.0 - 2026-07-21`，并覆盖 canonical 配置迁移、每周三保活默认计划和登录 Cookie 展示顺序变化。
- [x] `npm run lint`、`npm run type-check`、`npm test` 与 `git diff --check` 通过。
- [x] 发布相关改动已提交并推送到 `origin/master`。
- [x] 远端 `v3.10.0` 指向本次发布提交，Docker tag workflow 成功。
- [x] GitHub Release 包含 `douyu-keep-just-works-3.10.0-fnos.fpk` 与对应 `.sha256` 文件。
- [x] 最终工作区干净，`master` 与 `origin/master` 同步。

## Out of Scope

- 新功能或额外重构。
- 覆盖、移动或删除既有版本标签。
- 更改 GitHub Actions、Docker 或 fnOS 打包逻辑。
