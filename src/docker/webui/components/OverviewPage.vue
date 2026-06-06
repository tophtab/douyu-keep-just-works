<script setup lang="ts">
import type { useOverviewPage } from '../overview'
import type { WebUiPageTab } from '../navigation'
import FansStatusTable from './FansStatusTable.vue'
import PageSection from './PageSection.vue'

const props = defineProps<{
  selectTab: (tab: WebUiPageTab) => void
  state: ReturnType<typeof useOverviewPage>
}>()

const {
  overviewFansEmptyText,
  overviewFansFeedbackText,
  overviewFansRows,
  overviewGiftMetrics,
  overviewStatusCells,
  showOverviewFansTable,
  showOverviewLoginAction,
} = props.state
</script>

<template>
  <div class="overview-stack">
    <PageSection kicker="基础状态" title="概况">
      <div class="summary-grid quad">
        <div v-for="cell in overviewStatusCells" :key="cell.label" class="strip-metric">
          <div class="mini-label">
            {{ cell.label }}
          </div>
          <div class="mini-value">
            <span class="pill" :class="cell.enabled ? 'ok' : 'off'">{{ cell.enabled ? cell.enabledText : cell.disabledText }}</span>
          </div>
        </div>
      </div>
    </PageSection>

    <PageSection title="粉丝牌列表">
      <template #actions>
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
      </template>
      <div v-if="overviewFansFeedbackText" class="status-box" role="status" aria-live="polite">
        {{ overviewFansFeedbackText }}
      </div>
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
    </PageSection>
  </div>
</template>
