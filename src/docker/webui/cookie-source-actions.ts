import type { CookieDiagnostics, PassportQrLoginPublicStatus } from '../../core/types'
import { requestJson } from './request'
import { loadConfig, rawConfig, saveConfigPatch } from './resource-config'
import { clearCookieBackedData, refreshOverviewSurface } from './resource-state'
import { getErrorMessage, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'
import {
  applyLoginCookieSaveResponse,
  applyRawConfig,
  clearCookieDiagnostics,
  cookieDiagnostics,
  mainCookie,
  passportCookie,
  passportQrLogin,
  passportQrLoginBusy,
  yubaCookie,
} from './cookie-source-state'

interface PassportQrLoginResponse {
  data?: PassportQrLoginPublicStatus | null
}

let cookieDiagnosticsPending: Promise<CookieDiagnostics> | null = null

async function refreshOverviewAfterCookieChange(options: { showSuccessToast?: boolean } = {}): Promise<void> {
  await refreshOverviewSurface('overview', false)
  if (options.showSuccessToast) {
    showToast('状态已刷新', true)
  }
}

async function applyPassportQrLoginStatus(status: PassportQrLoginPublicStatus | null): Promise<void> {
  passportQrLogin.value = status
  if (!status?.mainSaved && !status?.yubaSaved) {
    return
  }

  await loadConfig()
  applyRawConfig(rawConfig.value)
  clearCookieBackedData()
  await refreshOverviewAfterCookieChange()
}

async function requestPassportQrLoginStatus(pathname: string): Promise<PassportQrLoginPublicStatus | null | undefined> {
  try {
    const data = await requestJson<PassportQrLoginResponse>(pathname, {
      method: pathname.endsWith('/status') ? 'GET' : 'POST',
    })
    await applyPassportQrLoginStatus(data.data || null)
    return data.data || null
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    showToast(`扫码登录失败：${getErrorMessage(error)}`, false)
    return undefined
  }
}

export async function startPassportQrLogin(): Promise<PassportQrLoginPublicStatus | undefined | null> {
  passportQrLoginBusy.value = true
  try {
    return await requestPassportQrLoginStatus('/api/cookie-source/passport-login/start')
  } finally {
    passportQrLoginBusy.value = false
  }
}

export async function pollPassportQrLogin(): Promise<PassportQrLoginPublicStatus | undefined | null> {
  const status = await requestPassportQrLoginStatus('/api/cookie-source/passport-login/poll')
  if (status?.status === 'yuba_saved') {
    showToast('扫码登录快照已保存', true)
  } else if (status?.status === 'yuba_failed') {
    showToast('主站登录态已保存，鱼吧登录态可重试', false)
  } else if (status?.status === 'failed' || status?.status === 'expired' || status?.status === 'cancelled') {
    showToast(status.message, false)
  }
  return status
}

export async function cancelPassportQrLogin(): Promise<void> {
  await requestPassportQrLoginStatus('/api/cookie-source/passport-login/cancel')
}

export async function retryPassportQrLoginYuba(): Promise<PassportQrLoginPublicStatus | undefined | null> {
  passportQrLoginBusy.value = true
  try {
    const status = await requestPassportQrLoginStatus('/api/cookie-source/passport-login/retry-yuba')
    if (status?.status === 'yuba_saved') {
      showToast('鱼吧登录态已保存', true)
    } else if (status?.status === 'yuba_failed') {
      showToast('鱼吧登录态获取失败，请稍后重试', false)
    }
    return status
  } finally {
    passportQrLoginBusy.value = false
  }
}

export async function saveCookie(): Promise<void> {
  const nextPassportCookie = passportCookie.value.trim()
  try {
    const result = await saveConfigPatch({
      loginCookies: {
        passport: nextPassportCookie,
        main: mainCookie.value.trim(),
        yuba: yubaCookie.value.trim(),
      },
    })
    if (result?.config) {
      applyLoginCookieSaveResponse(result.config)
    }
    clearCookieBackedData()
    showToast('手填 Cookie 已保存', true)
    await refreshOverviewAfterCookieChange()
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return
    }
    showToast(`保存手填 Cookie 失败：${getErrorMessage(error)}`, false)
  }
}

async function requestCookieDiagnostics(): Promise<CookieDiagnostics> {
  if (cookieDiagnosticsPending) {
    return await cookieDiagnosticsPending
  }

  cookieDiagnosticsPending = requestJson<CookieDiagnostics>('/api/cookie-source/check', {
    method: 'POST',
  }).then((data) => {
    cookieDiagnostics.value = data
    return data
  }).finally(() => {
    cookieDiagnosticsPending = null
  })

  return await cookieDiagnosticsPending
}

export async function refreshCookieDiagnostics(): Promise<CookieDiagnostics | undefined> {
  try {
    return await requestCookieDiagnostics()
  } catch (error) {
    clearCookieDiagnostics()
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    return undefined
  }
}

export async function checkCookieSource(showSuccessToast = true): Promise<CookieDiagnostics | undefined> {
  try {
    const data = await requestCookieDiagnostics()
    if (showSuccessToast !== false) {
      const readyForDyTokenYuba = data.main.ready && data.yuba.dyTokenReady
      showToast(readyForDyTokenYuba ? '登录凭证校验通过，dy-token 鱼吧请求已就绪' : '登录凭证已校验，请查看缺失项', readyForDyTokenYuba)
    }
    return data
  } catch (error) {
    clearCookieDiagnostics()
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    showToast(`校验登录凭证失败：${getErrorMessage(error)}`, false)
    return undefined
  }
}
