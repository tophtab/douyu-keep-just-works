import { computed, onBeforeUnmount, watch } from 'vue'
import { buildLoginStatus, buildPassportQrLoginText } from './cookie-source-copy'
import {
  cancelPassportQrLogin,
  checkCookieSource,
  pollPassportQrLogin,
  refreshCookieDiagnostics,
  retryPassportQrLoginYuba,
  saveCookie,
  startPassportQrLogin,
} from './cookie-source-actions'
import {
  applyRawConfig,
  clearCookieDiagnostics,
  mainCookie,
  passportCookie,
  passportQrLogin,
  passportQrLoginBusy,
  yubaCookie,
} from './cookie-source-state'
import { rawConfig } from './resource-config'

export function useCookieLoginPage() {
  let passportQrPollingTimer: ReturnType<typeof window.setInterval> | null = null
  const loginStatus = computed(() => buildLoginStatus())
  const passportQrLoginText = computed(() => buildPassportQrLoginText(passportQrLogin.value))

  function stopPassportQrPolling(): void {
    if (passportQrPollingTimer !== null) {
      window.clearInterval(passportQrPollingTimer)
      passportQrPollingTimer = null
    }
  }

  function shouldPollPassportQrLogin(): boolean {
    return Boolean(passportQrLogin.value && !passportQrLogin.value.finished)
  }

  function ensurePassportQrPolling(): void {
    stopPassportQrPolling()
    if (!shouldPollPassportQrLogin()) {
      return
    }
    passportQrPollingTimer = window.setInterval(() => {
      void pollPassportQrLogin().then(() => {
        if (!shouldPollPassportQrLogin()) {
          stopPassportQrPolling()
        }
      })
    }, 2000)
  }

  async function startPassportLogin(): Promise<void> {
    await startPassportQrLogin()
    ensurePassportQrPolling()
  }

  async function retryPassportYubaLogin(): Promise<void> {
    await retryPassportQrLoginYuba()
  }

  async function cancelPassportLogin(): Promise<void> {
    await cancelPassportQrLogin()
    stopPassportQrPolling()
  }

  watch(rawConfig, (config) => {
    applyRawConfig(config)
    if (!config) {
      clearCookieDiagnostics()
      return
    }
    void refreshCookieDiagnostics()
  }, { immediate: true })
  watch(passportQrLogin, ensurePassportQrPolling)
  onBeforeUnmount(stopPassportQrPolling)

  return {
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
  }
}
