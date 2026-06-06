<script setup lang="ts">
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

function updatePassword(event: Event): void {
  emit('update:password', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div id="auth-shell" class="auth-shell">
    <div class="auth-card">
      <section class="auth-panel" aria-labelledby="auth-title">
        <div class="auth-brand">
          <span class="auth-logo" aria-hidden="true" />
          <h1 id="auth-title" class="auth-title">
            {{ appName }}
          </h1>
        </div>

        <form id="login-form" autocomplete="on" @submit.prevent="emit('submit')">
          <div class="field-block auth-field">
            <label class="field-label auth-field-label" for="web-password-input">WebUI 密码</label>
            <input
              id="web-password-input"
              :value="password"
              name="web-password"
              type="password"
              autocomplete="current-password"
              spellcheck="false"
              placeholder="WebUI 密码"
              :aria-describedby="loginError ? 'login-error' : undefined"
              :aria-invalid="loginError ? 'true' : 'false'"
              :disabled="submittingLogin"
              @input="updatePassword"
            >
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
