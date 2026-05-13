import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { requestJson, UNAUTHORIZED_EVENT_NAME } from './request'
import { showToast } from './toast'

interface AuthStatusResponse {
  authenticated?: unknown
}

interface LegacyAuthBridge {
  clearProtectedState: () => void
  loadProtectedData: () => Promise<void>
}

interface AuthStateDetail {
  authenticated: boolean
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_LEGACY?: LegacyAuthBridge
  }
}

export const AUTH_STATE_EVENT_NAME = 'douyu-keep-webui:auth-state'
export const LEGACY_READY_EVENT_NAME = 'douyu-keep-webui:legacy-ready'
export { UNAUTHORIZED_EVENT_NAME }

function dispatchAuthState(authenticated: boolean): void {
  document.dispatchEvent(new CustomEvent<AuthStateDetail>(AUTH_STATE_EVENT_NAME, {
    detail: { authenticated },
  }))
}

function waitForLegacyBridge(): Promise<LegacyAuthBridge> {
  if (window.DOUYU_KEEP_WEBUI_LEGACY) {
    return Promise.resolve(window.DOUYU_KEEP_WEBUI_LEGACY)
  }

  return new Promise((resolve) => {
    document.addEventListener(LEGACY_READY_EVENT_NAME, () => {
      if (window.DOUYU_KEEP_WEBUI_LEGACY) {
        resolve(window.DOUYU_KEEP_WEBUI_LEGACY)
      }
    }, { once: true })
  })
}

function clearProtectedState(): void {
  window.DOUYU_KEEP_WEBUI_LEGACY?.clearProtectedState()
}

function consumeWebPasswordFromUrl(): { password: string, present: boolean } {
  const result = { password: '', present: false }

  try {
    const currentUrl = new URL(window.location.href)
    if (!currentUrl.searchParams.has('web-password')) {
      return result
    }

    result.present = true
    result.password = currentUrl.searchParams.get('web-password') || ''
    currentUrl.searchParams.delete('web-password')
    window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash)
  } catch {
    return result
  }

  return result
}

function getRequestErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useAuthSession() {
  const authChecked = ref(false)
  const authenticated = ref(false)
  const loginError = ref('')
  const password = ref('')
  const submittingLogin = ref(false)

  let authRequestSeq = 0

  function nextAuthRequestSeq(): number {
    authRequestSeq += 1
    return authRequestSeq
  }

  function isLatestAuthRequest(requestSeq: number): boolean {
    return authRequestSeq === requestSeq
  }

  function setAuthenticated(nextAuthenticated: boolean): void {
    authenticated.value = nextAuthenticated
  }

  async function loadProtectedData(): Promise<void> {
    const legacyBridge = await waitForLegacyBridge()
    dispatchAuthState(authenticated.value)
    await legacyBridge.loadProtectedData()
  }

  async function loadAuthStatus(): Promise<boolean> {
    const requestSeq = nextAuthRequestSeq()

    try {
      const data = await requestJson<AuthStatusResponse>('/api/auth/status', {
        onUnauthorized: false,
      })
      if (!isLatestAuthRequest(requestSeq)) {
        return authenticated.value
      }

      authChecked.value = true
      submittingLogin.value = false
      loginError.value = ''
      setAuthenticated(Boolean(data.authenticated))

      if (authenticated.value) {
        await loadProtectedData()
      }

      return authenticated.value
    } catch (error) {
      if (!isLatestAuthRequest(requestSeq)) {
        return authenticated.value
      }

      authChecked.value = true
      submittingLogin.value = false
      loginError.value = `检查登录状态失败：${getRequestErrorMessage(error)}`
      setAuthenticated(false)
      clearProtectedState()
      return false
    }
  }

  async function loginWithPassword(nextPassword: string, options: { clearPasswordInput?: boolean } = {}): Promise<boolean> {
    if (!nextPassword) {
      loginError.value = '请输入密码'
      return false
    }

    const requestSeq = nextAuthRequestSeq()
    submittingLogin.value = true
    loginError.value = ''

    try {
      await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword }),
        onUnauthorized: false,
      })
      if (!isLatestAuthRequest(requestSeq)) {
        return false
      }

      authChecked.value = true
      submittingLogin.value = false
      loginError.value = ''
      setAuthenticated(true)
      if (options.clearPasswordInput !== false) {
        password.value = ''
      }

      await loadProtectedData()
      if (!isLatestAuthRequest(requestSeq)) {
        return false
      }

      showToast('登录成功', true)
      return true
    } catch (error) {
      if (!isLatestAuthRequest(requestSeq)) {
        return false
      }

      submittingLogin.value = false
      setAuthenticated(false)
      loginError.value = `登录失败：${getRequestErrorMessage(error)}`
      return false
    }
  }

  async function submitLogin(): Promise<void> {
    await loginWithPassword(password.value)
  }

  async function logout(): Promise<void> {
    nextAuthRequestSeq()

    try {
      await requestJson('/api/auth/logout', { method: 'POST', onUnauthorized: false })
    } catch {
      // Client-side logout should still clear local protected state if the request fails.
    }

    password.value = ''
    submittingLogin.value = false
    loginError.value = ''
    authChecked.value = true
    setAuthenticated(false)
    clearProtectedState()
    showToast('已退出登录', true)
  }

  function handleUnauthorized(): void {
    nextAuthRequestSeq()
    password.value = ''
    submittingLogin.value = false
    loginError.value = '登录已失效，请重新输入密码。'
    authChecked.value = true
    setAuthenticated(false)
    clearProtectedState()
  }

  function startAuthSession(): void {
    const webPasswordLogin = consumeWebPasswordFromUrl()
    if (webPasswordLogin.present) {
      void loginWithPassword(webPasswordLogin.password, { clearPasswordInput: false })
      return
    }
    void loadAuthStatus()
  }

  watch(authenticated, (nextAuthenticated) => {
    document.body.setAttribute('data-auth', nextAuthenticated ? 'app' : 'login')
    dispatchAuthState(nextAuthenticated)
  }, { immediate: true })

  onMounted(() => {
    document.addEventListener(UNAUTHORIZED_EVENT_NAME, handleUnauthorized)
    startAuthSession()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(UNAUTHORIZED_EVENT_NAME, handleUnauthorized)
  })

  return {
    authChecked,
    authenticated,
    loginError,
    logout,
    password,
    submitLogin,
    submittingLogin,
  }
}
