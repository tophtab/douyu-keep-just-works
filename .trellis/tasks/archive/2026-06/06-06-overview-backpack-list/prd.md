# 概况页背包列表替换

## Goal

概况页当前在粉丝牌列表上方展示“粉丝牌列表”标题以及“当前荧光棒 / 过期时间”摘要。用户希望去掉这块顶部摘要区域，换成临期任务页里的背包列表；下面原有粉丝牌列表继续保留。

## What I Already Know

* 用户指出概况页中的顶部“粉丝牌列表 / 当前荧光棒 / 过期时间”区域需要替换。
* 用户澄清：不是替换整个粉丝牌列表；下面的粉丝牌列表要保留。
* `src/docker/webui/components/OverviewPage.vue` 当前在第二个 `PageSection` 中展示 `FansStatusTable` 和 `overviewGiftMetrics`。
* `src/docker/webui/components/ExpiringPage.vue` 使用 `ExpiringBackpackTable` 展示临期任务的背包列表。
* `src/docker/webui/expiring.ts` 已基于共享的 `giftStatus.rows` 构造 `expiringBackpackRows`、空态文案和是否临期标记。
* `src/docker/webui/overview.ts` 已经从 `resource-fans` 读取 `giftStatus`，概况页刷新现有路径会加载粉丝牌状态详情，因此能拿到背包明细。
* 用户希望相同表格内容尽量复用：背包列表在概况页和临期任务页一致；粉丝牌相关列也应避免重复构造。

## Assumptions

* “换成临期任务里的背包列表”指替换概况页中粉丝牌表格上方的摘要区域。
* 概况页不再显示“当前荧光棒 / 过期时间”摘要。
* 概况页背包列表应沿用临期页的表格字段和临期阈值判断；阈值使用当前临期任务配置，缺省时使用默认阈值。

## Requirements

* 概况页在粉丝牌列表上方展示背包列表。
* 概况页背包列表和粉丝牌列表不额外显示分区标题。
* 复用临期任务页的背包表格组件，避免维护两份表格模板。
* 概况页背包列表的数据来自共享 `giftStatus.rows`。
* 概况页背包列表应处理未配置 Cookie、加载中、加载失败、未刷新、空背包等状态。
* 概况页原有粉丝牌列表表格继续展示。
* 粉丝牌列表的通用列行数据应抽为共享构造函数，概况页和所有粉丝牌分配任务页只附加自己需要的额外列。
* 不改变后端接口和任务执行逻辑。

## Acceptance Criteria

* [ ] 概况页不再渲染“当前荧光棒 / 过期时间”摘要。
* [ ] 概况页渲染与临期任务页一致字段的背包列表。
* [ ] 概况页继续渲染 `FansStatusTable`。
* [ ] 概况页不额外显示“背包列表”“粉丝牌列表”分区标题。
* [ ] 概况页背包列表在无 Cookie、加载中、错误、未加载、空列表时有明确空态或反馈。
* [ ] 背包列表和粉丝牌通用行构造逻辑被复用，避免概况页、保活、双倍、临期等页面复制同一套字段映射。
* [ ] 临期任务页现有背包列表行为保持不变。
* [ ] lint / type-check / relevant tests pass.

## Definition Of Done

* Frontend code follows local component/state patterns.
* Shared logic is extracted only where it reduces duplication meaningfully.
* Existing tests are updated if contract expectations mention概况页粉丝牌表格或荧光棒摘要。
* Rollback is straightforward by reverting the overview component/state changes.

## Out Of Scope

* 新增后端 API。
* 改变背包数据排序、筛选规则或斗鱼接口解析。
* 改变临期任务配置、保存、执行逻辑。
* 重新设计概况页整体布局。

## Technical Notes

* Likely files:
  * `src/docker/webui/components/OverviewPage.vue`
  * `src/docker/webui/overview.ts`
  * `src/docker/webui/expiring.ts`
  * `src/docker/webui/components/ExpiringBackpackTable.vue`
  * contract tests under `test/`
* Relevant spec layer: `.trellis/spec/frontend/`.
