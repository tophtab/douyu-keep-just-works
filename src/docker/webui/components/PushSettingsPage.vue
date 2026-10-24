<script setup lang="ts">
import CronField from './CronField.vue'
import PageSection from './PageSection.vue'
import TaskSettingsSection from './TaskSettingsSection.vue'
import { usePushReportPage } from '../push-report'

const {
  channel,
  channelBaseUrl,
  channelEnabled,
  channelMode,
  channelSaving,
  channelTesting,
  channelToken,
  cookie,
  cookieHealthy,
  cron,
  enabled,
  time,
  enabledTasks,
  formatDuration,
  formatRunTime,
  lastLog,
  loadSnapshot,
  loading,
  save,
  saving,
  saveChannel,
  sendNow,
  sending,
  snapshot,
  summary,
  testChannel,
} = usePushReportPage()
</script>

<template>
  <div class="page-stack">
    <PageSection kicker="PUSH" title="推送汇总">
      <div class="push-summary-grid">
        <div class="push-summary-item">
          <div class="section-kicker">
            已启用任务
          </div>
          <div class="push-summary-value">
            {{ summary.total }}
          </div>
        </div>
        <div class="push-summary-item">
          <div class="section-kicker">
            今日成功
          </div>
          <div class="push-summary-value ok">
            {{ summary.ok }}
          </div>
        </div>
        <div class="push-summary-item">
          <div class="section-kicker">
            今日失败
          </div>
          <div class="push-summary-value fail">
            {{ summary.fail }}
          </div>
        </div>
        <div class="push-summary-item">
          <div class="section-kicker">
            今日未执行
          </div>
          <div class="push-summary-value muted">
            {{ summary.idle }}
          </div>
        </div>
      </div>
      <p class="helper push-summary-hint">
        单个任务执行完成后不再单独推送；这里设定的时间每天汇总一次，把所有已启用任务的执行情况（计划、最近执行、耗时、结果、摘要）合成一张飞书卡片推送。
      </p>
      <div v-if="snapshot?.nextRun" class="helper">
        下次推送：{{ formatRunTime({ finishedAt: snapshot.nextRun } as never) }}
      </div>
    </PageSection>

    <TaskSettingsSection
      v-model="enabled"
      input-id="push-report-enable"
      name="push-report-enable"
      label="每日推送汇总开关"
      title="每日推送汇总"
      note="关闭后不再自动推送，仍可手动「立即推送」"
    >
      <template #controls>
        <div class="field-block">
          <label class="field-label" for="push-report-time">每天推送时间</label>
          <input
            id="push-report-time"
            v-model="time"
            name="push-report-time"
            type="time"
            step="60"
          >
          <div class="helper">
            选择 HH:MM 即可；需要更复杂的周期时用下面的 Cron 表达式。
          </div>
        </div>
        <CronField
          v-model="cron"
          input-id="push-report-cron"
          name="push-report-cron"
          preview-id="push-report-cron-preview"
          :preview-text="cron ? `当前表达式：${cron}（6 段：秒 分 时 日 月 周）` : ''"
        />
      </template>
      <template #actions>
        <div class="actions">
          <button class="btn btn-success" type="button" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
          <button class="btn btn-secondary" type="button" :disabled="sending" @click="sendNow">
            {{ sending ? '推送中…' : '立即推送今日汇总' }}
          </button>
          <button class="btn btn-secondary" type="button" :disabled="loading" @click="loadSnapshot">
            刷新状态
          </button>
        </div>
      </template>
    </TaskSettingsSection>

    <PageSection kicker="CHANNEL" title="推送渠道">
      <div class="channel-form">
        <div class="channel-row">
          <label class="channel-switch">
            <input v-model="channelEnabled" type="checkbox">
            <span>启用推送渠道</span>
          </label>
          <span v-if="channel" class="pill" :class="channel.source === 'config' || channel.source === 'env' ? 'ok' : 'warn'">
            {{ channel.source === 'config' ? '界面配置生效' : channel.source === 'env' ? '环境变量生效' : channel.source === 'disabled' ? '已禁用' : '未配置' }}
          </span>
        </div>

        <div class="field-block">
          <label class="field-label" for="push-channel-url">网关地址（MagicPush）</label>
          <input
            id="push-channel-url"
            v-model="channelBaseUrl"
            name="push-channel-url"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="http://magicpush.example.com:818"
          >
          <div class="helper">
            填到端口即可，不要带 /api/push 后缀；留空则回退容器环境变量 MAGICPUSH_URL。
          </div>
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
          <div class="helper">
            在 MagicPush 面板「接口」里复制的令牌；留空表示保持现有值不变。
          </div>
        </div>

        <div class="field-block">
          <label class="field-label" for="push-channel-mode">消息格式</label>
          <select id="push-channel-mode" v-model="channelMode" name="push-channel-mode">
            <option value="card">
              飞书交互卡片（推荐，橙色主题）
            </option>
            <option value="text">
              Markdown 文本
            </option>
          </select>
          <div class="helper">
            卡片被飞书拒收时会自动降级为文本重发，通知不会丢。
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-success" type="button" :disabled="channelSaving" @click="saveChannel">
            {{ channelSaving ? '保存中…' : '保存渠道' }}
          </button>
          <button class="btn btn-secondary" type="button" :disabled="channelTesting" @click="testChannel">
            {{ channelTesting ? '发送中…' : '发送测试消息' }}
          </button>
        </div>
      </div>
    </PageSection>

    <PageSection kicker="COOKIE" title="登录状态">
      <div v-if="cookie" class="cookie-status">
        <div class="cookie-head">
          <span class="pill" :class="cookieHealthy ? 'ok' : 'warn'">
            {{ cookie.error ? '读取失败' : (cookieHealthy ? '正常' : '需要处理') }}
          </span>
          <span class="helper">
            来源：{{ cookie.source === 'cookieCloud' ? 'CookieCloud' : '本地扫码快照' }}
            <template v-if="cookie.updatedAt"> · 快照更新 {{ formatRunTime({ finishedAt: cookie.updatedAt } as never) }}</template>
          </span>
        </div>
        <div v-if="cookie.error" class="helper cookie-error">
          {{ cookie.error }}
        </div>
        <div v-else class="cookie-grid">
          <div class="cookie-item">
            <div class="section-kicker">
              LTP0 长效凭证
            </div>
            <div class="cookie-value" :class="cookie.ltp0Present ? 'ok' : 'fail'">
              {{ cookie.ltp0Present ? '正常' : '缺失' }}
            </div>
            <div class="helper">
              {{ cookie.ltp0Present ? '可自动续期' : '需重新扫码登录' }}
            </div>
          </div>
          <div class="cookie-item">
            <div class="section-kicker">
              主站登录态
            </div>
            <div class="cookie-value" :class="cookie.mainReady ? 'ok' : 'fail'">
              {{ cookie.mainReady ? '正常' : '不完整' }}
            </div>
            <div class="helper">
              {{ cookie.mainReady ? 'acf_* 字段齐全' : `缺少 ${cookie.mainMissingKeys.join(', ')}` }}
            </div>
          </div>
          <div class="cookie-item">
            <div class="section-kicker">
              鱼吧登录态
            </div>
            <div class="cookie-value" :class="cookie.yubaReady ? 'ok' : 'fail'">
              {{ cookie.yubaReady ? '正常' : '不完整' }}
            </div>
            <div class="helper">
              {{ cookie.yubaReady ? '可用于鱼吧签到' : `缺少 ${cookie.yubaMissingKeys.join(', ')}` }}
            </div>
          </div>
          <div class="cookie-item">
            <div class="section-kicker">
              Cookie 数量
            </div>
            <div class="cookie-value">
              {{ cookie.cookieCount }}
            </div>
            <div class="helper">
              条
            </div>
          </div>
        </div>
      </div>
      <div v-else class="helper">
        暂无登录态信息
      </div>
    </PageSection>

    <PageSection kicker="TODAY" title="今日各任务执行情况">
      <div class="table-shell">
        <table class="table table-fixed push-report-table">
          <thead>
            <tr>
              <th>任务</th>
              <th>状态</th>
              <th>计划</th>
              <th>最近执行</th>
              <th>耗时</th>
              <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in enabledTasks" :key="task.type">
              <td>{{ task.label }}</td>
              <td>
                <span
                  class="pill"
                  :class="task.lastRun ? (task.lastRun.ok ? 'ok' : 'warn') : 'off'"
                >
                  {{ task.lastRun ? (task.lastRun.ok ? '成功' : '失败') : '未执行' }}
                </span>
              </td>
              <td class="mono-cell">
                {{ task.cron || '—' }}
              </td>
              <td class="mono-cell">
                {{ formatRunTime(task.lastRun) }}
              </td>
              <td class="mono-cell">
                {{ formatDuration(task.lastRun) }}
              </td>
              <td class="ellipsis-cell" :title="lastLog(task.lastRun)">
                {{ lastLog(task.lastRun) }}
              </td>
            </tr>
            <tr v-if="enabledTasks.length === 0">
              <td colspan="6">
                <div class="empty">
                  当前没有已启用的任务
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
.channel-row{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
}
.channel-switch{
  display:flex;
  align-items:center;
  gap:8px;
  font-size:14px;
  cursor:pointer;
}
.channel-switch input{
  width:16px;
  height:16px;
  accent-color:var(--accent);
}
.cookie-status{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.cookie-head{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}
.cookie-error{
  color:#ff6b6b;
}
.cookie-grid{
  display:grid;
  gap:12px;
  grid-template-columns:repeat(4,minmax(0,1fr));
}
.cookie-item{
  border:1px solid var(--line);
  border-radius:16px;
  padding:12px 14px;
  background:var(--surface-2,rgba(255,255,255,.03));
}
.cookie-value{
  font-size:18px;
  font-weight:700;
  margin:4px 0 2px;
  color:var(--accent);
}
.cookie-value.ok{color:#3ddc84}
.cookie-value.fail{color:#ff6b6b}

.push-summary-grid{
  display:grid;
  gap:12px;
  grid-template-columns:repeat(4,minmax(0,1fr));
  margin-bottom:12px;
}
.push-summary-item{
  border:1px solid var(--line);
  border-radius:16px;
  padding:12px 14px;
  background:var(--surface-2,rgba(255,255,255,.03));
}
.push-summary-value{
  font-size:26px;
  font-weight:700;
  line-height:1.2;
  color:var(--accent);
}
.push-summary-value.ok{color:#3ddc84}
.push-summary-value.fail{color:#ff6b6b}
.push-summary-value.muted{color:var(--muted)}
.push-summary-hint{
  margin:0 0 8px;
  line-height:1.6;
}
.push-report-table .mono-cell{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12px;
  white-space:nowrap;
}
.push-report-table .ellipsis-cell{
  max-width:280px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
@media (max-width:900px){
  .push-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .cookie-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .table-shell{overflow-x:auto;}
}
@media (max-width:560px){
  .push-summary-grid,
  .cookie-grid{grid-template-columns:1fr;}
  .push-summary-value{font-size:22px;}
  .push-report-table .ellipsis-cell{max-width:160px;}
}
</style>
