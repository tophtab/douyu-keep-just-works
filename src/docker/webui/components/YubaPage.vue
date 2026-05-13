<script setup lang="ts">
import { useYubaTaskPage } from '../yuba'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
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
  yubaNote,
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
  <TaskStatusCard
    card-id="yuba-task-card"
    title="鱼吧签到"
    :pills="yubaTaskCard.pills"
    :cells="yubaTaskCard.cells"
  />
  <div id="yuba-note" class="status-box" role="status" aria-live="polite" style="margin-top:16px">
    {{ yubaNote }}
  </div>

  <div class="panel" style="margin-top:16px">
    <EnableSwitch
      v-model="yubaEnabled"
      input-id="yuba-enable"
      name="yuba-enable"
      label="启用鱼吧签到任务"
      title="启用鱼吧签到任务"
      note="通过当前鱼吧 HTTP 接口签到全部已关注鱼吧，不使用浏览器自动化。"
      @change="handleYubaToggle"
    />
    <div class="grid cols-2">
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
    </div>
    <ActionBar
      style="margin-top:16px"
      :actions="[
        { label: '保存并启用', kind: 'success' },
        { label: '立即签到', kind: 'secondary' },
      ]"
      @action="handleAction"
    />
    <div id="yuba-table-wrap" style="margin-top:16px">
      <div v-if="!showYubaTable" class="empty">
        {{ yubaEmptyText }}
      </div>
      <div v-else class="table-shell">
        <YubaStatusTable :rows="yubaTableRows" />
      </div>
    </div>
  </div>
</template>
