<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { requestJson } from '../request'

defineProps<{
  appName: string
  loginError: string
  password: string
  submittingLogin: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:password': [value: string]
}>()
// 密码提示：未登录也能读，默认折叠，点开才显示
const hint = ref('')
const hintOpen = ref(false)

onMounted(async () => {
  try {
    const res = await requestJson<{ hint?: string }>('/api/auth/hint', { errorToast: false })
    hint.value = (res?.hint || '').trim()
  } catch {
    // 没有提示或接口不可用时静默，不影响登录
  }
})

// 密码明文显示：点右侧眼睛切换，偏好存 localStorage（下次进来仍是上次的状态）
const SHOW_PASSWORD_KEY = 'douyu.keep.showPassword'
function readShowPassword(): boolean {
  try {
    return window.localStorage.getItem(SHOW_PASSWORD_KEY) === '1'
  } catch {
    return false
  }
}
const showPassword = ref(readShowPassword())

function togglePassword(): void {
  showPassword.value = !showPassword.value
  try {
    window.localStorage.setItem(SHOW_PASSWORD_KEY, showPassword.value ? '1' : '0')
  } catch {
    // 隐私模式或存储被禁用时忽略，不影响本次切换
  }
}

function updatePassword(event: Event): void {
  emit('update:password', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div id="auth-shell" class="auth-shell">
    <div class="auth-card">
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-brand">
          <img class="auth-logo" src="/icon.png" alt="" aria-hidden="true">
          <h1 id="auth-title" class="auth-title">
            {{ appName }}
          </h1>
        </div>

        <form id="login-form" autocomplete="on" @submit.prevent="emit('submit')">
          <div class="field-block auth-field">
            <label class="field-label auth-field-label" for="web-password-input">WebUI 密码</label>
            <div class="auth-input-wrap">
              <input
                id="web-password-input"
                :value="password"
                name="web-password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                spellcheck="false"
                placeholder="WebUI 密码"
                :aria-describedby="loginError ? 'login-error' : undefined"
                :aria-invalid="loginError ? 'true' : 'false'"
                :disabled="submittingLogin"
                @input="updatePassword"
              >
              <button
                class="auth-password-toggle"
                type="button"
                :aria-pressed="showPassword ? 'true' : 'false'"
                :aria-label="showPassword ? '隐藏密码' : '显示密码明文'"
                :title="showPassword ? '隐藏密码' : '显示密码明文'"
                :disabled="submittingLogin"
                @click="togglePassword"
              >
                <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true">
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
          </div>
          <div v-if="hint" class="auth-hint">
            <button
              class="auth-hint-toggle"
              type="button"
              :aria-expanded="hintOpen ? 'true' : 'false'"
              aria-controls="login-hint"
              @click="hintOpen = !hintOpen"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ 'auth-hint-chevron-open': hintOpen }">
                <path d="M9.29 6.71a1 1 0 0 1 1.42 0l5 5a1 1 0 0 1 0 1.42l-5 5a1 1 0 0 1-1.42-1.42L13.59 12 9.29 8.12a1 1 0 0 1 0-1.41z" />
              </svg>
              忘记密码？查看密码提示
            </button>
            <div v-show="hintOpen" id="login-hint" class="auth-hint-text" role="status">
              {{ hint }}
            </div>
          </div>

          <div v-if="loginError" id="login-error" class="auth-error" role="alert">
            {{ loginError }}
          </div>
          <div class="actions auth-actions">
            <button id="login-submit" class="btn btn-success" type="submit" :disabled="submittingLogin">
              {{ submittingLogin ? '登录中…' : '登录' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
