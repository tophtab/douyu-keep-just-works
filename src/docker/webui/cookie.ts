import { computed, watch } from 'vue'
import { buildCookieCheckText, buildLoginStatus } from './cookie-source-copy'
import {
  checkCookieSource,
  disableCookieCloud,
  saveAndEnableCookieCloud,
  saveCookie,
  saveCookieCloudToggle,
} from './cookie-source-actions'
import {
  applyRawConfig,
  cookieCheck,
  cookieCloud,
  cronPreviewText,
  loadCookieCloudCronPreview,
  mainCookie,
  passportCookie,
  yubaCookie,
} from './cookie-source-state'
import { rawConfig } from './resource-config'

export { syncCookieCloudToLoginCookies } from './cookie-source-actions'

export function useCookieLoginPage() {
  const cookieCheckText = computed(() => buildCookieCheckText(cookieCheck.value))
  const loginStatus = computed(() => buildLoginStatus())

  function handleCookieCloudToggle(): void {
    if (cookieCloud.active) {
      void saveCookieCloudToggle({ revertCheckboxOnError: true })
      return
    }
    void disableCookieCloud()
  }

  watch(rawConfig, applyRawConfig, { immediate: true })

  return {
    checkCookieSource,
    cookieCheckText,
    cookieCloud,
    cronPreviewText,
    handleCookieCloudToggle,
    loadCookieCloudCronPreview,
    loginStatus,
    mainCookie,
    passportCookie,
    saveAndEnableCookieCloud,
    saveCookie,
    yubaCookie,
  }
}
