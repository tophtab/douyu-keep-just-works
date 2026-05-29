<script setup lang="ts">
import { useCookieLoginPage } from '../cookie'
import ActionBar from './ActionBar.vue'
import CronField from './CronField.vue'
import EnableSwitch from './EnableSwitch.vue'
import TaskStatusCard from './TaskStatusCard.vue'

const {
  checkCookieSource,
  cookieCheckText,
  cookieCloud,
  cronPreviewText,
  handleCookieCloudToggle,
  loadCookieCloudCronPreview,
  loginStatus,
  mainCookie,
  passportLtp0,
  saveAndEnableCookieCloud,
  saveCookie,
  saveManualPassport,
  yubaCookie,
} = useCookieLoginPage()

function handleCookieCloudAction(index: number): void {
  if (index === 0) {
    void saveAndEnableCookieCloud()
    return
  }
  void checkCookieSource()
}
</script>

<template>
  <TaskStatusCard
    card-id="cookie-login-card"
    kicker="登录状态"
    title="登录"
    :pills="loginStatus.pills"
    :cells="loginStatus.cells"
    style="margin-bottom:16px"
  />

  <div class="panel">
    <h3 class="section-title">
      登录 Cookie
    </h3>
    <p class="subtle">
      运行时只使用本地登录 Cookie 快照。直播和鱼吧的 Cookie 分开保存，避免同名字段互相覆盖。启用 CookieCloud 后，系统会先同步到这里，再由各任务读取这两份本地值。
    </p>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="field-block" style="margin-top:0">
        <label class="field-label" for="main-cookie-input">斗鱼直播的 Cookie</label>
        <textarea id="main-cookie-input" v-model="mainCookie" name="main-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 www.douyu.com / douyu.com 登录 Cookie" />
      </div>
      <div class="field-block" style="margin-top:0">
        <label class="field-label" for="yuba-cookie-input">斗鱼鱼吧的 Cookie</label>
        <textarea id="yuba-cookie-input" v-model="yubaCookie" name="yuba-cookie" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 yuba.douyu.com 登录 Cookie" />
      </div>
    </div>
    <ActionBar :actions="[{ label: '保存手填 Cookie', kind: 'success' }]" @action="saveCookie" />
  </div>

  <div class="panel" style="margin-top:16px">
    <h3 class="section-title">
      手填 passport/LTP0
    </h3>
    <p class="subtle">
      可选。主站 Cookie 失效后，系统会从主站 Cookie 读取 dy_did，并使用这里保存的 LTP0 进行一次 safeAuth 恢复。
    </p>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="field-block" style="margin-top:0">
        <label class="field-label" for="manual-passport-ltp0">passport.douyu.com LTP0</label>
        <input id="manual-passport-ltp0" v-model="passportLtp0" name="manual-passport-ltp0" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="粘贴 passport.douyu.com 的 LTP0">
      </div>
    </div>
    <ActionBar :actions="[{ label: '保存 passport/LTP0', kind: 'success' }]" @action="saveManualPassport" />
  </div>

  <div class="panel" style="margin-top:16px">
    <div class="panel-head">
      <div>
        <h3 class="section-title" style="margin-top:0">
          CookieCloud 同步
        </h3>
        <p class="subtle">
          从浏览器同步斗鱼相关域完整 Cookie，自动覆盖主站与鱼吧，避免手动复制两份 Cookie。
        </p>
      </div>
      <EnableSwitch
        v-model="cookieCloud.active"
        input-id="cookie-cloud-enable"
        name="cookie-cloud-enable"
        label="启用 CookieCloud 同步"
        style="margin:0"
        @change="handleCookieCloudToggle"
      />
    </div>
    <div class="grid cols-2">
      <div class="field-block">
        <label class="field-label" for="cookie-cloud-endpoint">Endpoint</label>
        <input id="cookie-cloud-endpoint" v-model="cookieCloud.endpoint" name="cookie-cloud-endpoint" type="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://cookiecloud.example.com">
      </div>
      <div class="field-block">
        <label class="field-label" for="cookie-cloud-uuid">UUID</label>
        <input id="cookie-cloud-uuid" v-model="cookieCloud.uuid" name="cookie-cloud-uuid" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CookieCloud UUID">
      </div>
      <CronField
        v-model="cookieCloud.cron"
        input-id="cookie-cloud-cron"
        name="cookie-cloud-cron"
        preview-id="cookie-cloud-cron-preview"
        :preview-text="cronPreviewText"
        @input="loadCookieCloudCronPreview"
      />
      <div class="field-block">
        <label class="field-label" for="cookie-cloud-password">密码</label>
        <input id="cookie-cloud-password" v-model="cookieCloud.password" name="cookie-cloud-password" type="password" autocomplete="current-password" spellcheck="false" placeholder="CookieCloud Password">
      </div>
    </div>
    <div id="cookie-cloud-note" class="status-box" role="status" aria-live="polite" style="margin-top:16px">
      {{ cookieCheckText }}
    </div>
    <ActionBar
      class="cookie-cloud-actions"
      style="margin-top:16px"
      :actions="[
        { label: '保存并启用', kind: 'success' },
        { label: '同步并校验', kind: 'secondary' },
      ]"
      @action="handleCookieCloudAction"
    />
  </div>
</template>
