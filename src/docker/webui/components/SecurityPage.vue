<script setup lang="ts">
import { computed, reactive } from 'vue'
import PageSection from './PageSection.vue'
import PasswordToggle from './PasswordToggle.vue'
import TaskStatusCard from './TaskStatusCard.vue'
import { formatPasswordTime, useSecurityPage } from '../security'

const {
  confirmPassword,
  currentPassword,
  info,
  isDefaultPassword,
  mismatch,
  newPassword,
  saving,
  sourceLabel,
  strength,
  submit,
} = useSecurityPage()

const passwordPills = computed(() => {
  if (!info.value) {
    return [{ kind: 'off', label: '等待加载' }]
  }
  return [{
    kind: isDefaultPassword.value ? 'warn' : 'ok',
    label: isDefaultPassword.value ? '默认密码' : '正常',
  }]
})

const passwordCells = computed(() => [
  { label: '密码来源', value: sourceLabel.value },
  { label: '上次修改', value: formatPasswordTime(info.value?.updatedAt) },
])

const strengthTone = computed(() => {
  if (strength.value.level === 'weak') {
    return 'tone-danger'
  }
  return strength.value.level === 'medium' ? 'tone-warning' : 'tone-success'
})

// 三个密码框各自独立的小眼睛；本页是敏感操作，不记忆状态，刷新后一律回到隐藏
const visible = reactive({ current: false, next: false, confirm: false })

function toggleVisible(key: keyof typeof visible): void {
  visible[key] = !visible[key]
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="password-status-card"
      kicker="密码状态"
      title="密码"
      :pills="passwordPills"
      :cells="passwordCells"
    />

    <PageSection title="修改密码">
      <form class="grid" @submit.prevent="submit">
        <div class="grid cols-3 section-form-grid">
          <div class="field-block">
            <label class="field-label" for="security-current">当前密码</label>
            <div class="auth-input-wrap">
              <input
                id="security-current"
                v-model="currentPassword"
                name="security-current"
                :type="visible.current ? 'text' : 'password'"
                autocomplete="current-password"
                spellcheck="false"
              >
              <PasswordToggle :pressed="visible.current" @toggle="toggleVisible('current')" />
            </div>
            <div v-if="info?.source === 'env'" class="helper">
              当前密码来自 WEB_PASSWORD 环境变量；在此修改后会写入 config/auth.json，之后以新密码为准，环境变量不再生效。
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="security-new">新密码</label>
            <div class="auth-input-wrap">
              <input
                id="security-new"
                v-model="newPassword"
                name="security-new"
                :type="visible.next ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
                placeholder="至少 6 位"
              >
              <PasswordToggle :pressed="visible.next" @toggle="toggleVisible('next')" />
            </div>
            <div v-if="strength.text" class="helper" :class="strengthTone">
              {{ strength.text }}
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="security-confirm">确认新密码</label>
            <div class="auth-input-wrap">
              <input
                id="security-confirm"
                v-model="confirmPassword"
                name="security-confirm"
                :type="visible.confirm ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
              >
              <PasswordToggle :pressed="visible.confirm" @toggle="toggleVisible('confirm')" />
            </div>
            <div v-if="mismatch" class="helper tone-danger">
              两次输入的新密码不一致
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-success" type="submit" :disabled="saving">
            {{ saving ? '保存中…' : '修改密码' }}
          </button>
        </div>
      </form>
    </PageSection>
  </div>
</template>
