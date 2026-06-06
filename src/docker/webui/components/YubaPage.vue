<script setup lang="ts">
import { useYubaTaskPage } from '../yuba'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import DataContent from './DataContent.vue'
import FormField from './FormField.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'
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

function handleAction(id: string): void {
  if (id === 'save') {
    void saveYubaConfig()
    return
  }
  void triggerYubaTask()
}
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
        <FormField input-id="yuba-mode" label="签到模式">
          <select id="yuba-mode" v-model="yubaMode" name="yuba-mode">
            <option value="followed">
              签到全部已关注鱼吧
            </option>
          </select>
        </FormField>
      </template>
      <template #actions>
        <ActionBar
          class="section-actions"
          :actions="[
            { id: 'save', label: '保存并启用', kind: 'success' },
            { id: 'trigger', label: '立即签到', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
      <DataContent content-id="yuba-table-wrap" :show="showYubaTable" :empty-text="yubaEmptyText">
        <YubaStatusTable :rows="yubaTableRows" />
      </DataContent>
    </TaskSettingsSection>
  </div>
</template>
