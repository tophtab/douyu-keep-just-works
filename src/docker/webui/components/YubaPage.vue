<script setup lang="ts">
import { useYubaTaskPage } from '../yuba'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
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

function handleAction(index: number): void {
  if (index === 0) {
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
        <ActionBar
          class="section-actions"
          :actions="[
            { label: '保存并启用', kind: 'success' },
            { label: '立即签到', kind: 'secondary' },
          ]"
          @action="handleAction"
        />
      </template>
      <div id="yuba-table-wrap" class="section-block">
        <div v-if="!showYubaTable" class="empty">
          {{ yubaEmptyText }}
        </div>
        <div v-else class="table-shell">
          <YubaStatusTable :rows="yubaTableRows" />
        </div>
      </div>
    </TaskSettingsSection>
  </div>
</template>
