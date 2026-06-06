<script setup lang="ts">
defineProps<{
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
      <section class="auth-panel auth-hero">
        <div class="section-kicker">
          Docker WebUI
        </div>
        <h1 class="auth-title">
          先登录，再管理续牌任务。
        </h1>
        <p class="auth-copy">
          这个入口现在会先校验 WebUI 密码。登录后才能查看 Cookie、粉丝牌、任务状态和运行日志。
        </p>
        <ul class="auth-list">
          <li>登录成功后使用当前浏览器会话访问，不会把密码回显到页面。</li>
          <li>密码来自容器环境变量，默认可在 compose 文件里配置。</li>
          <li>现有任务配置和 Cookie 文件不会因为登录页改造而被重写。</li>
        </ul>
      </section>

      <section class="auth-panel">
        <div class="section-kicker">
          密码验证
        </div>
        <h2 class="auth-form-title">
          进入管理台
        </h2>
        <p class="subtle">
          输入 WebUI 密码，认证通过后再加载当前配置和状态。
        </p>
        <form id="login-form" autocomplete="on" @submit.prevent="emit('submit')">
          <div class="field-block" style="margin-top:18px">
            <label class="field-label" for="web-password-input">WebUI 密码</label>
            <input
              id="web-password-input"
              :value="password"
              name="web-password"
              type="password"
              autocomplete="current-password"
              spellcheck="false"
              placeholder="请输入管理密码"
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
        <div class="auth-hint">
          初始密码可通过容器环境变量 WEB_PASSWORD 配置。
        </div>
      </section>
    </div>
  </div>
</template>
