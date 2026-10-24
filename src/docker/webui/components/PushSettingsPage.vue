<script setup lang="ts">
import { computed } from 'vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
import PageSection from './PageSection.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'
import { usePushReportPage } from '../push-report'

const {
  channel,
  channelBaseUrl,
  channelEnabled,
  channelMode,
  channelSaving,
  channelTesting,
  channelToken,
  cron,
  enabled,
  formatRunTime,
  handleChannelToggle,
  handleToggle,
  save,
  saving,
  saveChannel,
  sendNow,
  sending,
  snapshot,
  summary,
  testChannel,
} = usePushReportPage()

const pushPills = computed(() => {
  if (!snapshot.value) {
    return [{ kind: 'off', label: '等待加载' }]
  }
  // 优先级：开关关闭 > 渠道/时间未配置 > 正常运行
  if (!enabled.value) {
    return [{ kind: 'off', label: '未启动' }]
  }
  const current = channel.value
  const channelReady = Boolean(current?.enabled && (current.source === 'config' || current.source === 'env'))
  if (!channelReady || !cron.value.trim()) {
    return [{ kind: 'warn', label: '未配置' }]
  }
  return [{ kind: 'ok', label: '已启动' }]
})

const pushCells = computed(() => {
  const ready = Boolean(snapshot.value)
  const ok = summary.value.ok
  const fail = summary.value.fail
  return [
    { label: '已启用任务', value: ready ? String(summary.value.total) : '—' },
    {
      label: '今日成功/失败',
      value: ready ? `${ok}/${fail}` : '—',
      parts: ready
        ? [
            { text: String(ok), tone: 'success' as const },
            { text: '/', tone: 'muted' as const },
            { text: String(fail), tone: 'danger' as const },
          ]
        : undefined,
    },
    { label: '下次推送', value: snapshot.value?.nextRun ? formatRunTime({ finishedAt: snapshot.value.nextRun } as never) : '—' },
  ]
})
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="push-status-card"
      kicker=""
      title="推送"
      :pills="pushPills"
      :cells="pushCells"
    />

    <TaskSettingsSection
      v-model="enabled"
      input-id="push-report-enable"
      name="push-report-enable"
      label="每日推送开关"
      title="每日推送开关"
      @change="handleToggle"
    >
      <template #controls>
        <CronField
          v-model="cron"
          input-id="push-report-cron"
          name="push-report-cron"
          preview-id="push-report-cron-preview"
          preview-text=""
        />
      </template>
      <template #actions>
        <div class="actions">
          <button class="btn btn-success" type="button" :disabled="saving" @click="save()">
            {{ saving ? '保存中…' : '保存并启用' }}
          </button>
          <button class="btn btn-secondary" type="button" :disabled="sending" @click="sendNow">
            {{ sending ? '推送中…' : '立即推送' }}
          </button>
        </div>
      </template>
    </TaskSettingsSection>

    <PageSection title="MagicPush">
      <template #actions>
        <EnableSwitch
          v-model="channelEnabled"
          input-id="push-channel-enable"
          name="push-channel-enable"
          label="启用推送渠道"
          @change="handleChannelToggle"
        />
      </template>
      <div class="channel-form">
        <div class="grid cols-3 section-form-grid">
          <div class="field-block">
            <label class="field-label" for="push-channel-url">网关地址</label>
            <input
              id="push-channel-url"
              v-model="channelBaseUrl"
              name="push-channel-url"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="http://magicpush.example.com:818"
            >
          </div>

          <div class="field-block">
            <label class="field-label" for="push-channel-token">Endpoint 令牌</label>
            <input
              id="push-channel-token"
              v-model="channelToken"
              name="push-channel-token"
              type="password"
              autocomplete="new-password"
              spellcheck="false"
              :placeholder="channel?.tokenSet ? `已配置 ${channel.tokenPreview}（留空不修改）` : '粘贴 MagicPush endpoint token'"
            >
          </div>

          <div class="field-block">
            <label class="field-label" for="push-channel-mode">消息格式</label>
            <select id="push-channel-mode" v-model="channelMode" name="push-channel-mode">
              <option value="card">
                飞书交互卡片
              </option>
              <option value="text">
                Markdown 文本
              </option>
            </select>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-success" type="button" :disabled="channelSaving" @click="saveChannel">
            {{ channelSaving ? '保存中…' : '保存并启用' }}
          </button>
          <button class="btn btn-secondary" type="button" :disabled="channelTesting" @click="testChannel">
            {{ channelTesting ? '发送中…' : '测试消息' }}
          </button>
        </div>
      </div>
    </PageSection>
  </div>
</template>

<style scoped>
.channel-form{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.channel-form .field-block{
  margin-bottom:0;
}
</style>
