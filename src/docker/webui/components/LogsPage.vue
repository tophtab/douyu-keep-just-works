<script setup lang="ts">
import type { WebUiPageTab } from '../navigation'
import { toRef } from 'vue'
import { useLogsPage } from '../logs-resource'
import PageSection from './PageSection.vue'

const props = defineProps<{
  activeTab: WebUiPageTab
  authenticated: boolean
}>()

const {
  clearLogs,
  clearingLogs,
  formattedLogs,
  isToday,
  logsAutoRefresh,
  logsDays,
  logsLoading,
  logsSelectedDay,
  logsSummary,
  logBoxRef,
  refreshLogs,
  refreshLogDays,
  selectDay,
} = useLogsPage(toRef(props, 'activeTab'), toRef(props, 'authenticated'))

function onDayChange(event: Event): void {
  selectDay((event.target as HTMLSelectElement).value)
}

function toggleAutoRefresh(): void {
  logsAutoRefresh.value = !logsAutoRefresh.value
}

function reloadDays(): void {
  refreshLogDays()
  refreshLogs()
}
</script>

<template>
  <PageSection title="运行日志" class="logs-panel">
    <template #actions>
      <button
        class="btn logs-refresh-toggle"
        :class="logsAutoRefresh ? 'btn-success' : 'btn-secondary'"
        type="button"
        :disabled="!isToday"
        :aria-pressed="logsAutoRefresh ? 'true' : 'false'"
        :aria-label="logsAutoRefresh ? '关闭自动刷新' : '开启自动刷新'"
        :title="isToday ? (logsAutoRefresh ? '自动刷新已开启' : '自动刷新已关闭') : '历史日志不支持自动刷新'"
        @click="toggleAutoRefresh"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v6h-6" />
        </svg>
      </button>
    </template>
    <p id="logs-summary" class="subtle" role="status" aria-live="polite">
      {{ logsSummary }}
    </p>
    <div class="actions">
      <button class="btn btn-secondary" type="button" :disabled="logsLoading" :aria-busy="logsLoading ? 'true' : 'false'" @click="reloadDays">
        {{ logsLoading ? '刷新中…' : '手动刷新' }}
      </button>
      <button
        class="btn btn-danger"
        type="button"
        :disabled="clearingLogs || !isToday"
        :aria-busy="clearingLogs ? 'true' : 'false'"
        :title="isToday ? '清空今日的日志（历史日期不受影响）' : '历史日志只读，不能清空'"
        @click="clearLogs"
      >
        {{ clearingLogs ? '清空中…' : '清空今日' }}
      </button>
      <label class="inline log-day-picker log-day-picker-end">
        <select
          id="logs-day-select"
          class="input log-day-select"
          :value="logsSelectedDay"
          aria-label="选择要查看的日志日期"
          @change="onDayChange"
        >
          <option value="">今日实时</option>
          <option v-for="day in logsDays" :key="day" :value="day">{{ day }}</option>
        </select>
      </label>
    </div>
    <div class="log-box">
      <div id="full-log-box" ref="logBoxRef" class="log-scroll">
        <div v-if="!formattedLogs.length" class="empty">
          {{ isToday ? '暂无日志' : '这一天没有日志' }}
        </div>
        <template v-else>
          <div v-for="(log, index) in formattedLogs" :key="`${log.timestamp}-${index}`" class="log-line">
            <span class="log-stamp">[{{ log.timestamp }}]</span>
            <span class="log-tag">{{ log.category }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </template>
      </div>
    </div>
  </PageSection>
</template>

<style scoped>
.logs-refresh-toggle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:38px;
  height:38px;
  padding:0;
  border-radius:50%;
}
.logs-refresh-toggle svg{
  width:18px;
  height:18px;
  fill:none;
  stroke:currentColor;
  stroke-width:2;
  stroke-linecap:round;
  stroke-linejoin:round;
}
</style>
