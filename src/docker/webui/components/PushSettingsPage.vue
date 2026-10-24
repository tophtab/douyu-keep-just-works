<script setup lang="ts">
import { computed, ref } from 'vue'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
import PageSection from './PageSection.vue'
import PasswordToggle from './PasswordToggle.vue'
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

const pushActions = computed(() => [
  { label: saving.value ? '保存中…' : '保存并启用', kind: 'success' as const, disabled: saving.value },
  { label: sending.value ? '推送中…' : '立即推送', kind: 'secondary' as const, disabled: sending.value },
])

const channelActions = computed(() => [
  { label: channelSaving.value ? '保存中…' : '保存并启用', kind: 'success' as const, disabled: channelSaving.value },
  { label: channelTesting.value ? '发送中…' : '测试消息', kind: 'secondary' as const, disabled: channelTesting.value },
])

// 令牌框与登录页一致：默认隐藏，仅本次页面内切换明文
const tokenVisible = ref(false)

function handlePushAction(index: number): void {
  if (index === 0) {
    void save()
    return
  }
  void sendNow()
}

function handleChannelAction(index: number): void {
  if (index === 0) {
    void saveChannel()
    return
  }
  void testChannel()
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="push-status-card"
      kicker="推送状态"
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
        <ActionBar :actions="pushActions" @action="handlePushAction" />
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
          <div class="auth-input-wrap">
            <input
              id="push-channel-token"
              v-model="channelToken"
              name="push-channel-token"
              :type="tokenVisible ? 'text' : 'password'"
              autocomplete="new-password"
              spellcheck="false"
              :placeholder="channel?.tokenSet ? `已配置 ${channel.tokenPreview}（留空不修改）` : '粘贴 MagicPush endpoint token'"
            >
            <PasswordToggle :pressed="tokenVisible" @toggle="tokenVisible = !tokenVisible" />
          </div>
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

      <ActionBar :actions="channelActions" @action="handleChannelAction" />
    </PageSection>
  </div>
</template>
