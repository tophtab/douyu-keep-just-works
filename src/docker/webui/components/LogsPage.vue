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

function reloadDays(): void {
  refreshLogDays()
  refreshLogs()
}
</script>

<template>
  <PageSection title="运行日志">
    <p id="logs-summary" class="subtle" role="status" aria-live="polite">
      {{ logsSummary }}
    </p>
    <div class="actions">
      <label class="inline log-day-picker">
        <span>日期</span>
        <select
          id="logs-day-select"
          class="input log-day-select"
          :value="logsSelectedDay"
          aria-label="选择要查看的日志日期"
          @change="onDayChange"
        >
          <option value="">今天（实时）</option>
          <option v-for="day in logsDays" :key="day" :value="day">{{ day }}</option>
        </select>
      </label>
      <button class="btn btn-secondary" type="button" :disabled="logsLoading" :aria-busy="logsLoading ? 'true' : 'false'" @click="reloadDays">
        {{ logsLoading ? '刷新中…' : '手动刷新' }}
      </button>
      <button
        class="btn btn-danger"
        type="button"
        :disabled="clearingLogs || !isToday"
        :aria-busy="clearingLogs ? 'true' : 'false'"
        :title="isToday ? '清空今天的日志（历史日期不受影响）' : '历史日志只读，不能清空'"
        @click="clearLogs"
      >
        {{ clearingLogs ? '清空中…' : '清空今天' }}
      </button>
      <label class="inline">
        <input id="logs-auto-refresh" v-model="logsAutoRefresh" type="checkbox" name="logs-auto-refresh" :disabled="!isToday">
        <span>自动刷新</span>
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
