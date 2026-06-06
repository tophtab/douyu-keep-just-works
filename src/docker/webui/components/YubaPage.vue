<script setup lang="ts">
import { useYubaTaskPage } from '../yuba'
import CronField from './CronField.vue'
import TaskActionBar from './TaskActionBar.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'
import TaskTableSection from './TaskTableSection.vue'
import YubaStatusTable from './YubaStatusTable.vue'

const {
  handleYubaToggle,
  loadYubaCronPreview,
  saveYubaConfig,
  showYubaTable,
  triggerYubaTask,
  yubaCron,
  yubaCronPreviewText,
  yubaEmptyText,
  yubaEnabled,
  yubaMode,
  yubaTableRows,
  yubaTaskCard,
} = useYubaTaskPage()
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="yuba-task-card"
      title="鱼吧签到"
      :pills="yubaTaskCard.pills"
      :cells="yubaTaskCard.cells"
    />

    <TaskSettingsSection
      v-model="yubaEnabled"
      input-id="yuba-enable"
      name="yuba-enable"
      label="鱼吧任务开关"
      title="鱼吧任务开关"
      :control-columns="2"
      @change="handleYubaToggle"
    >
      <template #controls>
        <CronField
          v-model="yubaCron"
          input-id="yuba-cron"
          name="yuba-cron"
          preview-id="yuba-cron-preview"
          :preview-text="yubaCronPreviewText"
          @input="loadYubaCronPreview"
        />
        <div class="field-block">
          <label class="field-label" for="yuba-mode">签到模式</label>
          <select id="yuba-mode" v-model="yubaMode" name="yuba-mode">
            <option value="followed">
              签到全部已关注鱼吧
            </option>
          </select>
        </div>
      </template>
      <template #actions>
        <TaskActionBar
          secondary-label="立即签到"
          @save="saveYubaConfig"
          @trigger="triggerYubaTask"
        />
      </template>
      <TaskTableSection
        id="yuba-table-wrap"
        :show-table="showYubaTable"
        :empty-text="yubaEmptyText"
      >
        <YubaStatusTable :rows="yubaTableRows" />
      </TaskTableSection>
    </TaskSettingsSection>
  </div>
</template>
