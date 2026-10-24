<script setup lang="ts">
import { reactive } from 'vue'
import PageSection from './PageSection.vue'
import { formatPasswordTime, useSecurityPage } from '../security'

const {
  canSubmit,
  confirmPassword,
  currentPassword,
  hintInput,
  hintSaved,
  hintSaving,
  info,
  isDefaultPassword,
  loadInfo,
  loading,
  mismatch,
  newPassword,
  saveHint,
  saving,
  sourceLabel,
  strength,
  submit,
} = useSecurityPage()

// 三个密码框各自独立的小眼睛；本页是敏感操作，不记忆状态，刷新后一律回到隐藏
const visible = reactive({ current: false, next: false, confirm: false })

function toggleVisible(key: keyof typeof visible): void {
  visible[key] = !visible[key]
}
</script>

<template>
  <div class="page-stack">
    <PageSection kicker="SECURITY" title="登录密码">
      <div class="security-status">
        <div class="security-status-row">
          <span class="section-kicker">当前状态</span>
          <span class="pill" :class="isDefaultPassword ? 'warn' : 'ok'">
            {{ sourceLabel }}
          </span>
          <button class="btn btn-secondary btn-inline" type="button" :disabled="loading" @click="loadInfo">
            刷新
          </button>
        </div>
        <div v-if="info?.updatedAt" class="helper">
          上次修改：{{ formatPasswordTime(info.updatedAt) }}
        </div>
        <div v-if="isDefaultPassword" class="helper security-warn">
          ⚠️ 正在使用默认密码，建议立即修改；该服务若暴露到局域网之外风险很高。
        </div>
        <div v-else-if="info?.source === 'env'" class="helper">
          当前密码来自容器环境变量 <code>WEB_PASSWORD</code>。修改后会写入 <code>config/auth.json</code> 并优先生效，
          环境变量里的旧值不再使用（可自行从 <code>.env</code> 删除）。
        </div>
      </div>
    </PageSection>

    <PageSection kicker="HINT" title="密码提示">
      <div class="security-form">
        <div class="field-block">
          <label class="field-label" for="security-hint">登录页显示的提示</label>
          <input
            id="security-hint"
            v-model="hintInput"
            name="security-hint"
            type="text"
            maxlength="100"
            autocomplete="off"
            spellcheck="false"
            placeholder="例如：常用密码 + 生日后四位"
          >
          <div class="helper">
            忘记密码时，登录页可以展开看到这段提示。**不要填写密码本身**，建议写成只有自己懂的线索；留空保存即清除。
          </div>
          <div v-if="hintSaved" class="helper hint-saved">
            ✅ 已保存
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-success" type="button" :disabled="hintSaving" @click="saveHint">
            {{ hintSaving ? '保存中…' : (hintInput.trim() ? '保存提示' : '清除提示') }}
          </button>
        </div>
      </div>
    </PageSection>

    <PageSection kicker="CHANGE" title="修改密码">
      <form class="security-form" @submit.prevent="submit">
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
              :aria-pressed="visible.current ? 'true' : 'false'"
              :aria-label="visible.current ? '隐藏当前密码' : '显示当前密码明文'"
              :title="visible.current ? '隐藏当前密码' : '显示当前密码明文'"
              @click="toggleVisible('current')"
            >
              <svg v-if="!visible.current" viewBox="0 0 24 24" aria-hidden="true">
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
              :aria-pressed="visible.next ? 'true' : 'false'"
              :aria-label="visible.next ? '隐藏新密码' : '显示新密码明文'"
              :title="visible.next ? '隐藏新密码' : '显示新密码明文'"
              @click="toggleVisible('next')"
            >
              <svg v-if="!visible.next" viewBox="0 0 24 24" aria-hidden="true">
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
              :aria-pressed="visible.confirm ? 'true' : 'false'"
              :aria-label="visible.confirm ? '隐藏确认密码' : '显示确认密码明文'"
              :title="visible.confirm ? '隐藏确认密码' : '显示确认密码明文'"
              @click="toggleVisible('confirm')"
            >
              <svg v-if="!visible.confirm" viewBox="0 0 24 24" aria-hidden="true">
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

        <div class="actions">
          <button class="btn btn-success" type="submit" :disabled="!canSubmit">
            {{ saving ? '保存中…' : '修改密码' }}
          </button>
        </div>

        <p class="helper security-note">
          修改成功后其他设备上的登录会立即失效；当前浏览器会自动换成新会话，无需重新登录。
          密码以 scrypt 加盐哈希保存在 <code>config/auth.json</code>（0600），不保存明文。
        </p>
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
.security-status{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.security-status-row{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}
.btn-inline{
  padding:4px 10px;
  font-size:12px;
}
.security-form{
  display:flex;
  flex-direction:column;
  gap:14px;
  max-width:420px;
}
@media (max-width:560px){
  .security-form{max-width:none;}
  .security-status-row{gap:8px;}
}
.hint-saved{
  color:#3ddc84;
}
.security-warn{
  color:#ffb454;
}
.security-error{
  color:#ff6b6b;
}
.security-note{
  margin:0;
  line-height:1.7;
}
.strength-weak{color:#ff6b6b}
.strength-medium{color:#ffb454}
.strength-strong{color:#3ddc84}
code{
  background:rgba(255,255,255,.08);
  padding:1px 5px;
  border-radius:4px;
}
</style>
