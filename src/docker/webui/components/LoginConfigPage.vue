<script setup lang="ts">
import type { PassportQrLoginPublicStatus } from '../../../core/types'
import type { ActionBarAction } from '../ui-types'
import { useCookieLoginPage } from '../cookie'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
import FormField from './FormField.vue'
import PageSection from './PageSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

const {
  cancelPassportLogin,
  checkCookieSource,
  cookieCloud,
  cronPreviewText,
  handleCookieCloudToggle,
  loadCookieCloudCronPreview,
  loginStatus,
  mainCookie,
  passportCookie,
  passportQrLogin,
  passportQrLoginBusy,
  passportQrLoginText,
  retryPassportYubaLogin,
  saveAndEnableCookieCloud,
  saveCookie,
  startPassportLogin,
  yubaCookie,
} = useCookieLoginPage()

function handleManualCookieAction(id: string): void {
  if (id === 'passport-login') {
    void startPassportLogin()
    return
  }
  void saveCookie()
}

function handleCookieCloudAction(id: string): void {
  if (id === 'save') {
    void saveAndEnableCookieCloud()
    return
  }
  void checkCookieSource()
}

function handlePassportQrAction(id: string): void {
  if (id === 'retry-yuba') {
    void retryPassportYubaLogin()
    return
  }
  void cancelPassportLogin()
}

function getPassportQrActions(status: PassportQrLoginPublicStatus): ActionBarAction[] {
  const actions: ActionBarAction[] = []
  if (status.canRetryYuba) {
    actions.push({ id: 'retry-yuba', label: '重试鱼吧', kind: 'secondary' })
  }
  if (!status.finished) {
    actions.push({ id: 'cancel', label: '取消', kind: 'secondary' })
  }
  return actions
}

function isPassportQrScanned(status: PassportQrLoginPublicStatus): boolean {
  return status.status === 'scanned' || isPassportQrConfirmed(status)
}

function isPassportQrConfirmed(status: PassportQrLoginPublicStatus): boolean {
  return status.passportSaved || status.mainSaved || status.yubaSaved
}
</script>

<template>
  <div class="page-stack">
    <TaskStatusCard
      card-id="cookie-login-card"
      kicker="登录状态"
      title="登录"
      :pills="loginStatus.pills"
      :cells="loginStatus.cells"
    />

    <PageSection title="登录 Cookie">
      <div class="grid cols-3 section-form-grid">
        <FormField input-id="main-cookie-input" label="斗鱼直播的 Cookie">
          <textarea id="main-cookie-input" v-model="mainCookie" name="main-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 www.douyu.com / douyu.com 登录 Cookie" />
        </FormField>
        <FormField input-id="yuba-cookie-input" label="斗鱼鱼吧的 Cookie">
          <textarea id="yuba-cookie-input" v-model="yubaCookie" name="yuba-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 yuba.douyu.com 登录 Cookie" />
        </FormField>
        <FormField input-id="manual-passport-cookie" label="passport.douyu.com Cookie">
          <textarea id="manual-passport-cookie" v-model="passportCookie" name="manual-passport-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="dy_did=...; LTP0=..." rows="4" />
        </FormField>
      </div>
      <ActionBar
        class="section-actions"
        :actions="[
          { id: 'passport-login', label: passportQrLoginBusy ? '扫码中' : '扫码登录', kind: 'primary' },
          { id: 'save-manual', label: '手填保存', kind: 'secondary' },
        ]"
        @action="handleManualCookieAction"
      />
      <div v-if="passportQrLogin" class="passport-qr-panel" role="status" aria-live="polite">
        <img
          v-if="passportQrLogin.qrImageDataUrl"
          class="passport-qr-image"
          :src="passportQrLogin.qrImageDataUrl"
          alt="斗鱼扫码登录二维码"
        >
        <div class="passport-qr-copy">
          <div class="mini-label">
            扫码登录
          </div>
          <div class="mini-value">
            {{ passportQrLoginText }}
          </div>
          <div class="passport-qr-steps" aria-label="扫码登录进度">
            <span :class="{ ok: isPassportQrScanned(passportQrLogin) }">扫码</span>
            <span :class="{ ok: isPassportQrConfirmed(passportQrLogin) }">确认</span>
            <span :class="{ ok: passportQrLogin.mainSaved }">主站</span>
            <span :class="{ ok: passportQrLogin.yubaSaved, warn: passportQrLogin.canRetryYuba }">鱼吧</span>
          </div>
          <ActionBar
            v-if="passportQrLogin.canRetryYuba || !passportQrLogin.finished"
            class="passport-qr-actions"
            :actions="getPassportQrActions(passportQrLogin)"
            @action="handlePassportQrAction"
          />
        </div>
      </div>
    </PageSection>

    <PageSection title="CookieCloud 同步">
      <template #actions>
        <EnableSwitch
          v-model="cookieCloud.active"
          input-id="cookie-cloud-enable"
          name="cookie-cloud-enable"
          label="启用 CookieCloud 同步"
          @change="handleCookieCloudToggle"
        />
      </template>
      <div class="grid cols-2 section-form-grid">
        <FormField input-id="cookie-cloud-endpoint" label="服务器地址">
          <input id="cookie-cloud-endpoint" v-model="cookieCloud.endpoint" name="cookie-cloud-endpoint" type="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://cookiecloud.example.com">
        </FormField>
        <FormField input-id="cookie-cloud-uuid" label="UUID">
          <input id="cookie-cloud-uuid" v-model="cookieCloud.uuid" name="cookie-cloud-uuid" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CookieCloud UUID">
        </FormField>
        <CronField
          v-model="cookieCloud.cron"
          input-id="cookie-cloud-cron"
          name="cookie-cloud-cron"
          preview-id="cookie-cloud-cron-preview"
          :preview-text="cronPreviewText"
          @input="loadCookieCloudCronPreview"
        />
        <FormField input-id="cookie-cloud-password" label="密码">
          <input id="cookie-cloud-password" v-model="cookieCloud.password" name="cookie-cloud-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="CookieCloud Password">
        </FormField>
      </div>
      <ActionBar
        class="cookie-cloud-actions section-actions"
        :actions="[
          { id: 'save', label: '保存并启用', kind: 'success' },
          { id: 'check', label: '同步并校验', kind: 'secondary' },
        ]"
        @action="handleCookieCloudAction"
      />
    </PageSection>
  </div>
</template>
