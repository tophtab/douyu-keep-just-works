<script setup lang="ts">
import { useDoubleTaskPage } from '../double'
import ActionBar from './ActionBar.vue'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import DataContent from './DataContent.vue'
import FormField from './FormField.vue'
import InlineFeedback from './InlineFeedback.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

interface DoubleAllocationRow {
  enabled?: boolean
  value: number
}

const {
  applyDoubleRatioPreset,
  doubleCron,
  doubleCronPreviewText,
  doubleEmptyText,
  doubleEnabled,
  doubleFanRows,
  doubleGiftScope,
  doubleModeHelp,
  doubleModel,
  doubleRatioPreview,
  doubleTaskCard,
  doubleValueLabel,
  handleDoubleToggle,
  loadDoubleCronPreview,
  saveDoubleConfig,
  showDoubleRatioTools,
  showDoubleTable,
  triggerDoubleTask,
} = useDoubleTaskPage()

function handleAction(id: string): void {
  if (id === 'save') {
    void saveDoubleConfig()
    return
  }
  void triggerDoubleTask()
}

function updateRowEnabled(row: DoubleAllocationRow, value: boolean): void {
  row.enabled = value
}

function updateRowValue(row: DoubleAllocationRow, value: number): void {
  row.value = value
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="double-task-card"
      title="双倍"
      :pills="doubleTaskCard.pills"
      :cells="doubleTaskCard.cells"
    />

    <TaskSettingsSection
      v-model="doubleEnabled"
      input-id="double-enable"
      name="double-enable"
      label="双倍任务开关"
      title="双倍任务开关"
      :control-columns="3"
      @change="handleDoubleToggle"
    >
      <template #controls>
        <CronField
          v-model="doubleCron"
          input-id="double-cron"
          name="double-cron"
          preview-id="double-cron-preview"
          :preview-text="doubleCronPreviewText"
          @input="loadDoubleCronPreview"
        />
        <FormField input-id="double-gift-scope" label="礼物范围">
          <select id="double-gift-scope" v-model="doubleGiftScope" name="double-gift-scope">
            <option value="glowStick">
              全部荧光棒
            </option>
            <option value="limitedTime">
              限时礼物
            </option>
          </select>
        </FormField>
        <FormField input-id="double-model" label="分配模式">
          <select id="double-model" v-model.number="doubleModel" name="double-model">
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
            { id: 'trigger', label: '立即检测', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
      <InlineFeedback>
        <div class="split-inline">
          <div class="split-inline-copy">
            <h3 class="section-title">
              分配说明
            </h3>
            <p id="double-mode-help" class="subtle double-help">
              {{ doubleModeHelp }}
            </p>
            <div id="double-ratio-preview" class="helper double-ratio-preview" role="status" aria-live="polite">
              {{ doubleRatioPreview }}
            </div>
          </div>
          <div v-show="showDoubleRatioTools" id="double-ratio-tools" class="split-inline-actions">
            <button class="btn btn-secondary" type="button" @click="applyDoubleRatioPreset('equal')">
              平均权重
            </button>
            <button class="btn btn-secondary" type="button" @click="applyDoubleRatioPreset('level')">
              等级权重
            </button>
          </div>
        </div>
      </InlineFeedback>
      <DataContent content-id="double-table-wrap" :show="showDoubleTable" :empty-text="doubleEmptyText">
        <AllocationTable
          table-class="double-table"
          input-class="double-value"
          input-name-prefix="double-value"
          enabled-class="double-enabled"
          enabled-name-prefix="double-enabled"
          task-label="双倍"
          show-enabled
          :show-index="false"
          :rows="doubleFanRows"
          :value-label="doubleValueLabel"
          @enabled-change="updateRowEnabled"
          @value-change="updateRowValue"
        />
      </DataContent>
    </TaskSettingsSection>
  </div>
</template>
