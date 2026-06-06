<script setup lang="ts">
import { updateAllocationRowEnabled, updateAllocationRowValue } from '../allocation-task'
import { useDoubleTaskPage } from '../double'
import AllocationTable from './AllocationTable.vue'
import CronField from './CronField.vue'
import TableSection from './TableSection.vue'
import TaskActionBar from './TaskActionBar.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

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
        <div class="field-block">
          <label class="field-label" for="double-gift-scope">礼物范围</label>
          <select id="double-gift-scope" v-model="doubleGiftScope" name="double-gift-scope">
            <option value="glowStick">
              全部荧光棒
            </option>
            <option value="limitedTime">
              限时礼物
            </option>
          </select>
        </div>
        <div class="field-block">
          <label class="field-label" for="double-model">分配模式</label>
          <select id="double-model" v-model.number="doubleModel" name="double-model">
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
          secondary-label="立即检测"
          @save="saveDoubleConfig"
          @trigger="triggerDoubleTask"
        />
      </template>
      <div class="status-box">
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
      </div>
      <TableSection
        id="double-table-wrap"
        :show-table="showDoubleTable"
        :empty-text="doubleEmptyText"
      >
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
          @enabled-change="updateAllocationRowEnabled"
          @value-change="updateAllocationRowValue"
        />
      </TableSection>
    </TaskSettingsSection>
  </div>
</template>
