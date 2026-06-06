<script setup lang="ts">
import { updateAllocationRowValue } from '../allocation-task'
import { useExpiringGiftTaskPage } from '../expiring'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import ExpiringBackpackTable from './ExpiringBackpackTable.vue'
import TableSection from './TableSection.vue'
import TaskActionBar from './TaskActionBar.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

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
      </template>
      <template #actions>
        <TaskActionBar
          secondary-label="立即执行"
          @save="saveExpiringGiftConfig"
          @trigger="triggerExpiringTask"
        />
      </template>
      <TableSection
        id="expiring-backpack-wrap"
        :show-table="showExpiringBackpackTable"
        :empty-text="expiringBackpackEmptyText"
      >
        <ExpiringBackpackTable :rows="expiringBackpackRows" />
      </TableSection>
      <TableSection
        id="expiring-table-wrap"
        :show-table="showExpiringTable"
        :empty-text="expiringTableEmptyText"
      >
        <AllocationTable
          table-class="expiring-table"
          input-class="expiring-value"
          input-name-prefix="expiring-value"
          task-label="临期"
          :rows="expiringFanRows"
          :value-label="expiringValueLabel"
          @value-change="updateAllocationRowValue"
        />
      </TableSection>
    </TaskSettingsSection>
  </div>
</template>
