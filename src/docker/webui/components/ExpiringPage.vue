<script setup lang="ts">
import { useExpiringGiftTaskPage } from '../expiring'
import ActionBar from './ActionBar.vue'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import DataContent from './DataContent.vue'
import ExpiringBackpackTable from './ExpiringBackpackTable.vue'
import FormField from './FormField.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

interface AllocationValueRow {
  value: number
}

const {
  expiringBackpackEmptyText,
  expiringBackpackRows,
  expiringCron,
  expiringCronPreviewText,
  expiringEnabled,
  expiringFanRows,
  expiringModel,
  expiringTableEmptyText,
  expiringTaskCard,
  expiringThresholdHours,
  expiringValueLabel,
  handleExpiringModelChange,
  handleExpiringToggle,
  loadExpiringCronPreview,
  saveExpiringGiftConfig,
  showExpiringBackpackTable,
  showExpiringTable,
  triggerExpiringTask,
} = useExpiringGiftTaskPage()

function handleAction(id: string): void {
  if (id === 'save') {
    void saveExpiringGiftConfig()
    return
  }
  void triggerExpiringTask()
}

function updateRowValue(row: AllocationValueRow, value: number): void {
  row.value = value
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="expiring-task-card"
      title="临期"
      :pills="expiringTaskCard.pills"
      :cells="expiringTaskCard.cells"
    />

    <TaskSettingsSection
      v-model="expiringEnabled"
      input-id="expiring-enable"
      name="expiring-enable"
      label="临期任务开关"
      title="临期任务开关"
      :control-columns="3"
      @change="handleExpiringToggle"
    >
      <template #controls>
        <CronField
          v-model="expiringCron"
          input-id="expiring-cron"
          name="expiring-cron"
          preview-id="expiring-cron-preview"
          :preview-text="expiringCronPreviewText"
          @input="loadExpiringCronPreview"
        />
        <FormField input-id="expiring-threshold-hours" label="临期阈值（小时）">
          <input id="expiring-threshold-hours" v-model.number="expiringThresholdHours" name="expiring-threshold-hours" type="number" min="1" step="1" inputmode="numeric">
        </FormField>
        <FormField input-id="expiring-model" label="分配模式">
          <select id="expiring-model" v-model.number="expiringModel" name="expiring-model" @change="handleExpiringModelChange">
            <option value="1">
              按权重
            </option>
            <option value="2">
              按固定数量
            </option>
          </select>
        </FormField>
      </template>
      <template #actions>
        <ActionBar
          class="section-actions"
          :actions="[
            { id: 'save', label: '保存并启用', kind: 'success' },
            { id: 'trigger', label: '立即执行', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
      <DataContent content-id="expiring-backpack-wrap" :show="showExpiringBackpackTable" :empty-text="expiringBackpackEmptyText">
        <ExpiringBackpackTable :rows="expiringBackpackRows" />
      </DataContent>
      <DataContent content-id="expiring-table-wrap" :show="showExpiringTable" :empty-text="expiringTableEmptyText">
        <AllocationTable
          table-class="expiring-table"
          input-class="expiring-value"
          input-name-prefix="expiring-value"
          task-label="临期"
          :rows="expiringFanRows"
          :value-label="expiringValueLabel"
          @value-change="updateRowValue"
        />
      </DataContent>
    </TaskSettingsSection>
  </div>
</template>
