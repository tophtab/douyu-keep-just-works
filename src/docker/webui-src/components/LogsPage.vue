<script setup lang="ts">
import type { WebUiPageTab } from '../navigation'
import { toRef } from 'vue'
import { useLogsPage } from '../resources'

const props = defineProps<{
  activeTab: WebUiPageTab
  authenticated: boolean
}>()

const {
  clearLogs,
  clearingLogs,
  formattedLogs,
  logsAutoRefresh,
  logsLoading,
  logsSummary,
  logBoxRef,
  refreshLogs,
} = useLogsPage(toRef(props, 'activeTab'), toRef(props, 'authenticated'))
</script>

<template>
  <div class="panel">
    <h3 class="section-title">
      运行日志
    </h3>
    <p id="logs-summary" class="subtle" role="status" aria-live="polite" style="margin-top:10px">
      {{ logsSummary }}
    </p>
    <div class="actions" style="margin-top:16px">
      <button class="btn btn-secondary" type="button" :disabled="logsLoading" :aria-busy="logsLoading ? 'true' : 'false'" @click="refreshLogs">
        {{ logsLoading ? '刷新中…' : '手动刷新' }}
      </button>
      <button class="btn btn-danger" type="button" :disabled="clearingLogs" :aria-busy="clearingLogs ? 'true' : 'false'" @click="clearLogs">
        {{ clearingLogs ? '清空中…' : '清空日志' }}
      </button>
      <label class="inline" style="margin-left:4px">
        <input id="logs-auto-refresh" v-model="logsAutoRefresh" type="checkbox" name="logs-auto-refresh">
        <span>自动刷新</span>
      </label>
    </div>
    <div id="full-log-box" ref="logBoxRef" class="log-box" style="margin-top:16px">
      <div v-if="!formattedLogs.length" class="empty">
        暂无日志
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
</template>
