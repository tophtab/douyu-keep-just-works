<script setup lang="ts">
import { useExpiringGiftTaskPage } from '../expiring'
import ActionBar from './ActionBar.vue'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
import ExpiringBackpackTable from './ExpiringBackpackTable.vue'
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

function handleAction(index: number): void {
  if (index === 0) {
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
  <TaskStatusCard
    card-id="expiring-task-card"
    title="临期"
    :pills="expiringTaskCard.pills"
    :cells="expiringTaskCard.cells"
  />

  <div class="panel" style="margin-top:16px">
    <EnableSwitch
      v-model="expiringEnabled"
      input-id="expiring-enable"
      name="expiring-enable"
      label="临期任务开关"
      title="临期任务开关"
      @change="handleExpiringToggle"
    />
    <div class="grid cols-3">
      <CronField
        v-model="expiringCron"
        input-id="expiring-cron"
        name="expiring-cron"
        preview-id="expiring-cron-preview"
        :preview-text="expiringCronPreviewText"
        @input="loadExpiringCronPreview"
      />
      <div class="field-block">
        <label class="field-label" for="expiring-threshold-hours">临期阈值（小时）</label>
        <input id="expiring-threshold-hours" v-model.number="expiringThresholdHours" name="expiring-threshold-hours" type="number" min="1" step="1" inputmode="numeric">
      </div>
      <div class="field-block">
        <label class="field-label" for="expiring-model">分配模式</label>
        <select id="expiring-model" v-model.number="expiringModel" name="expiring-model" @change="handleExpiringModelChange">
          <option value="1">
            按权重
          </option>
          <option value="2">
            按固定数量
          </option>
        </select>
      </div>
    </div>
    <ActionBar
      :actions="[
        { label: '保存并启用', kind: 'success' },
        { label: '立即执行', kind: 'secondary' },
      ]"
      @action="handleAction"
    />
    <div id="expiring-backpack-wrap" style="margin-top:16px">
      <div v-if="!showExpiringBackpackTable" class="empty">
        {{ expiringBackpackEmptyText }}
      </div>
      <div v-else class="table-shell">
        <ExpiringBackpackTable :rows="expiringBackpackRows" />
      </div>
    </div>
    <div id="expiring-table-wrap" style="margin-top:16px">
      <div v-if="!showExpiringTable" class="empty">
        {{ expiringTableEmptyText }}
      </div>
      <div v-else class="table-shell">
        <AllocationTable
          table-class="expiring-table"
          input-class="expiring-value"
          input-name-prefix="expiring-value"
          task-label="临期"
          :rows="expiringFanRows"
          :value-label="expiringValueLabel"
          @value-change="updateRowValue"
        />
      </div>
    </div>
  </div>
</template>
