<script setup lang="ts">
import { useCollectTaskPage } from '../collect'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
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

function handleAction(index: number): void {
  if (index === 0) {
    void saveCollectConfig()
    return
  }
  void triggerCollectTask()
}
</script>

<template>
  <TaskStatusCard
    card-id="collect-task-card"
    title="领取"
    :pills="collectTaskCard.pills"
    :cells="collectTaskCard.cells"
    style="margin-bottom:16px"
  />

  <div class="panel">
    <div class="panel-head">
      <div>
        <h3 class="section-title" style="margin-top:0">
          启动领取任务
        </h3>
        <p class="subtle">
          领取任务独立成栏，包含任务状态、启停控制、Cron 设置和手动触发。
        </p>
      </div>
      <EnableSwitch
        v-model="collectEnabled"
        input-id="collect-enable"
        name="collect-enable"
        label="启用领取任务"
        style="margin:0"
        @change="handleCollectToggle"
      />
    </div>
    <CronField
      v-model="collectCron"
      input-id="collect-cron"
      name="collect-cron"
      preview-id="collect-cron-preview"
      :preview-text="collectCronPreviewText"
      @input="loadCollectCronPreview"
    />
    <ActionBar
      :actions="[
        { label: '保存并启用', kind: 'success' },
        { label: '立即领取', kind: 'secondary' },
      ]"
      @action="handleAction"
    />
  </div>
</template>
