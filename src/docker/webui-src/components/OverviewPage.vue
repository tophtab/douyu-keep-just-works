<script setup lang="ts">
import type { useOverviewPage } from '../overview'
import type { WebUiPageTab } from '../navigation'
import FansStatusTable from './FansStatusTable.vue'

const props = defineProps<{
  selectTab: (tab: WebUiPageTab) => void
  state: ReturnType<typeof useOverviewPage>
}>()

const {
  overviewFansEmptyText,
  overviewFansNote,
  overviewFansRows,
  overviewGiftMetrics,
  overviewStatusCells,
  showOverviewFansTable,
  showOverviewLoginAction,
} = props.state
</script>

<template>
  <div class="overview-stack">
    <div class="panel">
      <div class="section-kicker">
        基础状态
      </div>
      <h3 class="section-title">
        概况
      </h3>
      <p class="subtle">
        这里只保留登录与任务开关概览，详细状态请进入对应功能页查看。
      </p>
      <div class="summary-grid quad" style="margin-top:16px">
        <div v-for="cell in overviewStatusCells" :key="cell.label" class="strip-metric">
          <div class="mini-label">
            {{ cell.label }}
          </div>
          <div class="mini-value">
            <span class="pill" :class="cell.enabled ? 'ok' : 'off'">{{ cell.enabled ? cell.enabledText : cell.disabledText }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">
            粉丝牌
          </div>
          <h3 class="section-title">
            粉丝牌列表
          </h3>
          <p class="subtle">
            概况页直接展示当前粉丝牌与双倍状态。
          </p>
        </div>
        <div class="strip-metrics compact overview-gift-summary">
          <div v-for="metric in overviewGiftMetrics" :key="metric.label" class="strip-metric">
            <div class="mini-label">
              {{ metric.label }}
            </div>
            <div class="mini-value">
              {{ metric.value }}
            </div>
          </div>
        </div>
      </div>
      <div class="subtle overview-table-note" role="status" aria-live="polite">
        {{ overviewFansNote }}
      </div>
      <div style="margin-top:16px">
        <div v-if="showOverviewLoginAction" class="empty empty-with-action">
          保存 Cookie 或启用 CookieCloud 后再点击顶部“刷新”，这里会直接展示粉丝牌与双倍状态。
          <div class="empty-action">
            <button class="btn btn-primary" type="button" @click="selectTab('login')">
              前往登录
            </button>
          </div>
        </div>
        <div v-else-if="showOverviewFansTable" class="table-shell">
          <FansStatusTable :rows="overviewFansRows" show-double-status />
        </div>
        <div v-else class="empty">
          {{ overviewFansEmptyText }}
        </div>
      </div>
    </div>
  </div>
</template>
