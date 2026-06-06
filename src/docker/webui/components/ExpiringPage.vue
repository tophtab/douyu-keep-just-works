<script setup lang="ts">
import type { FieldValue } from '../ui-types'
import { useExpiringGiftTaskPage } from '../expiring'
import ActionBar from './ActionBar.vue'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import DataContent from './DataContent.vue'
import ExpiringBackpackTable from './ExpiringBackpackTable.vue'
import NumberField from './NumberField.vue'
import SelectField from './SelectField.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

interface AllocationValueRow {
  value: number
}

const allocationModelOptions = [
  { label: '按权重', value: 1 },
  { label: '按固定数量', value: 2 },
]

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

function updateExpiringModel(value: FieldValue): void {
  expiringModel.value = String(value) === '2' ? 2 : 1
  handleExpiringModelChange()
}

function updateExpiringThresholdHours(value: FieldValue): void {
  expiringThresholdHours.value = Number(value)
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
        <NumberField
          input-id="expiring-threshold-hours"
          :model-value="expiringThresholdHours"
          name="expiring-threshold-hours"
          label="临期阈值（小时）"
          min="1"
          step="1"
          inputmode="numeric"
          @update:model-value="updateExpiringThresholdHours"
        />
        <SelectField
          input-id="expiring-model"
          :model-value="expiringModel"
          name="expiring-model"
          label="分配模式"
          :options="allocationModelOptions"
          @update:model-value="updateExpiringModel"
        />
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
