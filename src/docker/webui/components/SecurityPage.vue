<script setup lang="ts">
import { computed, reactive } from 'vue'
import PageSection from './PageSection.vue'
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
      kicker=""
      title="登录密码"
      :pills="passwordPills"
      :cells="passwordCells"
    />

    <PageSection title="修改密码">
      <form class="security-form" @submit.prevent="submit">
        <div class="grid cols-3 section-form-grid">
          <div class="field-block">
            <label class="field-label" for="security-current">当前密码</label>
            <div class="field-with-eye">
              <input
                id="security-current"
                v-model="currentPassword"
                name="security-current"
                :type="visible.current ? 'text' : 'password'"
                autocomplete="current-password"
                spellcheck="false"
              >
              <button
                class="auth-password-toggle"
                type="button"
                tabindex="-1"
                :aria-pressed="visible.current ? 'true' : 'false'"
                :aria-label="visible.current ? '隐藏密码' : '显示密码'"
                :title="visible.current ? '隐藏密码' : '显示密码'"
                @click="toggleVisible('current')"
              >
                <svg v-if="visible.current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z" />
                  <circle cx="12" cy="12" r="3.1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.7 6.1A10 10 0 0 1 12 6c5.8 0 9.4 6 9.4 6a17.6 17.6 0 0 1-3.1 3.8" />
                  <path d="M6.4 7.8A17.4 17.4 0 0 0 2.6 12S6.2 18 12 18a10 10 0 0 0 4-.85" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              </button>
            </div>
            <div v-if="info?.source === 'env'" class="helper">
              当前密码来自 WEB_PASSWORD 环境变量；在此修改后会写入 config/auth.json，之后以新密码为准，环境变量不再生效。
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="security-new">新密码</label>
            <div class="field-with-eye">
              <input
                id="security-new"
                v-model="newPassword"
                name="security-new"
                :type="visible.next ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
                placeholder="至少 6 位"
              >
              <button
                class="auth-password-toggle"
                type="button"
                tabindex="-1"
                :aria-pressed="visible.next ? 'true' : 'false'"
                :aria-label="visible.next ? '隐藏密码' : '显示密码'"
                :title="visible.next ? '隐藏密码' : '显示密码'"
                @click="toggleVisible('next')"
              >
                <svg v-if="visible.next" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z" />
                  <circle cx="12" cy="12" r="3.1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.7 6.1A10 10 0 0 1 12 6c5.8 0 9.4 6 9.4 6a17.6 17.6 0 0 1-3.1 3.8" />
                  <path d="M6.4 7.8A17.4 17.4 0 0 0 2.6 12S6.2 18 12 18a10 10 0 0 0 4-.85" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              </button>
            </div>
            <div v-if="strength.text" class="helper" :class="`strength-${strength.level}`">
              {{ strength.text }}
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="security-confirm">确认新密码</label>
            <div class="field-with-eye">
              <input
                id="security-confirm"
                v-model="confirmPassword"
                name="security-confirm"
                :type="visible.confirm ? 'text' : 'password'"
                autocomplete="new-password"
                spellcheck="false"
              >
              <button
                class="auth-password-toggle"
                type="button"
                tabindex="-1"
                :aria-pressed="visible.confirm ? 'true' : 'false'"
                :aria-label="visible.confirm ? '隐藏密码' : '显示密码'"
                :title="visible.confirm ? '隐藏密码' : '显示密码'"
                @click="toggleVisible('confirm')"
              >
                <svg v-if="visible.confirm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z" />
                  <circle cx="12" cy="12" r="3.1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.7 6.1A10 10 0 0 1 12 6c5.8 0 9.4 6 9.4 6a17.6 17.6 0 0 1-3.1 3.8" />
                  <path d="M6.4 7.8A17.4 17.4 0 0 0 2.6 12S6.2 18 12 18a10 10 0 0 0 4-.85" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              </button>
            </div>
            <div v-if="mismatch" class="helper security-error">
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

<style scoped>
.field-with-eye{
  position:relative;
  display:block;
}
.field-with-eye input{
  width:100%;
  padding-right:56px;
}
.security-form{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.security-form .field-block{
  margin-bottom:0;
}
.security-error{
  color:#ff6b6b;
}
.strength-weak{color:#ff6b6b}
.strength-medium{color:#ffb454}
.strength-strong{color:#3ddc84}
</style>
