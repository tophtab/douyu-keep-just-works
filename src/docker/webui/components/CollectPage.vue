<script setup lang="ts">
import { useCollectTaskPage } from '../collect'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

const {
  collectCron,
  collectCronPreviewText,
  collectEnabled,
  collectTaskCard,
  handleCollectToggle,
  loadCollectCronPreview,
  saveCollectConfig,
  triggerCollectTask,
} = useCollectTaskPage()

function handleAction(id: string): void {
  if (id === 'save') {
    void saveCollectConfig()
    return
  }
  void triggerCollectTask()
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="collect-task-card"
      title="领取"
      :pills="collectTaskCard.pills"
      :cells="collectTaskCard.cells"
    />

    <TaskSettingsSection
      v-model="collectEnabled"
      input-id="collect-enable"
      name="collect-enable"
      label="领取任务开关"
      title="领取任务开关"
      @change="handleCollectToggle"
    >
      <template #controls>
        <CronField
          v-model="collectCron"
          input-id="collect-cron"
          name="collect-cron"
          preview-id="collect-cron-preview"
          :preview-text="collectCronPreviewText"
          @input="loadCollectCronPreview"
        />
      </template>
      <template #actions>
        <ActionBar
          class="section-actions"
          :actions="[
            { id: 'save', label: '保存并启用', kind: 'success' },
            { id: 'trigger', label: '立即领取', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
    </TaskSettingsSection>
  </div>
</template>
