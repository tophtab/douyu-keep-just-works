<script setup lang="ts">
import type { PassportQrLoginPublicStatus } from '../../../core/types'
import { useCookieLoginPage } from '../cookie'
import ActionBar from './ActionBar.vue'
import PageSection from './PageSection.vue'
import TaskStatusCard from './TaskStatusCard.vue'

const {
  cancelPassportLogin,
  checkCookieSource,
  loginStatus,
  mainCookie,
  passportCookie,
  passportQrLogin,
  passportQrLoginBusy,
  passportQrLoginText,
  retryPassportYubaLogin,
  saveCookie,
  startPassportLogin,
  yubaCookie,
} = useCookieLoginPage()

function handleManualCookieAction(index: number): void {
  if (index === 0) {
    void startPassportLogin()
    return
  }
  if (index === 1) {
    void saveCookie()
    return
  }
  void checkCookieSource()
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
        <div class="field-block">
          <label class="field-label" for="manual-passport-cookie">passport.douyu.com Cookie</label>
          <div class="cookie-input-frame">
            <textarea id="manual-passport-cookie" v-model="passportCookie" class="cookie-input" name="manual-passport-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="dy_did=...; LTP0=..." rows="4" />
          </div>
        </div>
        <div class="field-block">
          <label class="field-label" for="main-cookie-input">斗鱼直播的 Cookie</label>
          <div class="cookie-input-frame">
            <textarea id="main-cookie-input" v-model="mainCookie" class="cookie-input" name="main-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 www.douyu.com / douyu.com 登录 Cookie" />
          </div>
        </div>
        <div class="field-block">
          <label class="field-label" for="yuba-cookie-input">斗鱼鱼吧的 Cookie</label>
          <div class="cookie-input-frame">
            <textarea id="yuba-cookie-input" v-model="yubaCookie" class="cookie-input" name="yuba-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 yuba.douyu.com 登录 Cookie" />
          </div>
        </div>
      </div>
      <ActionBar
        class="section-actions"
        :actions="[
          { label: passportQrLoginBusy ? '扫码中' : '扫码登录', kind: 'primary' },
          { label: '手填保存', kind: 'secondary' },
          { label: '诊断检查', kind: 'secondary' },
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
          <div class="actions passport-qr-actions">
            <button
              v-if="passportQrLogin.canRetryYuba"
              class="btn btn-secondary"
              type="button"
              @click="retryPassportYubaLogin"
            >
              重试鱼吧
            </button>
            <button
              v-if="!passportQrLogin.finished"
              class="btn btn-secondary"
              type="button"
              @click="cancelPassportLogin"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </PageSection>
  </div>
</template>
