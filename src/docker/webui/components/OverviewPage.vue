<script setup lang="ts">
import type { useOverviewPage } from '../overview'
import ExpiringBackpackTable from './ExpiringBackpackTable.vue'
import FansStatusTable from './FansStatusTable.vue'
import PageSection from './PageSection.vue'
import TableSection from './TableSection.vue'

const props = defineProps<{
  state: ReturnType<typeof useOverviewPage>
}>()

const {
  overviewBackpackEmptyText,
  overviewBackpackRows,
  overviewFansEmptyText,
  overviewFansFeedbackText,
  overviewFansRows,
  overviewStatusCells,
  showOverviewBackpackTable,
  showOverviewFansTable,
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

    <TableSection
      :show-table="showOverviewBackpackTable"
      :empty-text="overviewBackpackEmptyText"
    >
      <ExpiringBackpackTable :rows="overviewBackpackRows" />
    </TableSection>

    <div v-if="overviewFansFeedbackText" class="status-box" role="status" aria-live="polite">
      {{ overviewFansFeedbackText }}
    </div>
    <TableSection
      :show-table="showOverviewFansTable"
      :empty-text="overviewFansEmptyText"
    >
      <FansStatusTable :rows="overviewFansRows" show-double-status />
    </TableSection>
  </div>
</template>
