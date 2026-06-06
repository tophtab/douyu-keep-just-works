<script setup lang="ts">
import type { WebUiPageTab } from '../navigation'
import { toRef } from 'vue'
import { useLogsPage } from '../logs-resource'
import ActionBar from './ActionBar.vue'
import EmptyState from './EmptyState.vue'
import PageSection from './PageSection.vue'

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

function handleAction(id: string): void {
  if (id === 'refresh') {
    void refreshLogs()
    return
  }
  void clearLogs()
}
</script>

<template>
  <PageSection title="运行日志">
    <p id="logs-summary" class="subtle" role="status" aria-live="polite">
      {{ logsSummary }}
    </p>
    <ActionBar
      :actions="[
        { id: 'refresh', label: '手动刷新', loadingLabel: '刷新中…', kind: 'secondary', loading: logsLoading },
        { id: 'clear', label: '清空日志', loadingLabel: '清空中…', kind: 'danger', loading: clearingLogs },
      ]"
      @action="handleAction"
    >
      <template #controls>
        <label class="inline">
          <input id="logs-auto-refresh" v-model="logsAutoRefresh" type="checkbox" name="logs-auto-refresh">
          <span>自动刷新</span>
        </label>
      </template>
    </ActionBar>
    <div id="full-log-box" ref="logBoxRef" class="log-box">
      <EmptyState v-if="!formattedLogs.length" text="暂无日志" />
      <template v-else>
        <div v-for="(log, index) in formattedLogs" :key="`${log.timestamp}-${index}`" class="log-line">
          <span class="log-stamp">[{{ log.timestamp }}]</span>
          <span class="log-tag">{{ log.category }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </template>
    </div>
  </PageSection>
</template>
