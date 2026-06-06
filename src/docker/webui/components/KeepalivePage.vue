<script setup lang="ts">
import { useKeepaliveTaskPage } from '../keepalive'
import ActionBar from './ActionBar.vue'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

interface AllocationValueRow {
  value: number
}

const {
  fanRows,
  handleKeepaliveModelChange,
  handleKeepaliveToggle,
  keepaliveCron,
  keepaliveCronPreviewText,
  keepaliveEmptyText,
  keepaliveEnabled,
  keepaliveModel,
  keepaliveTaskCard,
  keepaliveValueLabel,
  loadKeepaliveCronPreview,
  saveKeepaliveConfig,
  showKeepaliveTable,
  triggerKeepaliveTask,
} = useKeepaliveTaskPage()

function handleAction(index: number): void {
  if (index === 0) {
    void saveKeepaliveConfig()
    return
  }
  void triggerKeepaliveTask()
}

function updateRowValue(row: AllocationValueRow, value: number): void {
  row.value = value
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="keepalive-task-card"
      title="保活"
      :pills="keepaliveTaskCard.pills"
      :cells="keepaliveTaskCard.cells"
    />

    <TaskSettingsSection
      v-model="keepaliveEnabled"
      input-id="keepalive-enable"
      name="keepalive-enable"
      label="保活任务开关"
      title="保活任务开关"
      :control-columns="2"
      @change="handleKeepaliveToggle"
    >
      <template #controls>
        <CronField
          v-model="keepaliveCron"
          input-id="keepalive-cron"
          name="keepalive-cron"
          preview-id="keepalive-cron-preview"
          :preview-text="keepaliveCronPreviewText"
          @input="loadKeepaliveCronPreview"
        />
        <div class="field-block">
          <label class="field-label" for="keepalive-model">分配模式</label>
          <select id="keepalive-model" v-model.number="keepaliveModel" name="keepalive-model" @change="handleKeepaliveModelChange">
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
        <ActionBar
          class="section-actions"
          :actions="[
            { label: '保存并启用', kind: 'success' },
            { label: '立即保活', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
      <div id="keepalive-table-wrap" class="section-block">
        <div v-if="!showKeepaliveTable" class="empty">
          {{ keepaliveEmptyText }}
        </div>
        <div v-else class="table-shell">
          <AllocationTable
            table-class="keepalive-table"
            input-class="keepalive-value"
            input-name-prefix="keepalive-value"
            task-label="保活"
            :rows="fanRows"
            :value-label="keepaliveValueLabel"
            @value-change="updateRowValue"
          />
        </div>
      </div>
    </TaskSettingsSection>
  </div>
</template>
