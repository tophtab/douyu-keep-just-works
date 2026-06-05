import type { CookieDiagnostics, DockerConfig, EffectiveCookiePreview, PassportQrLoginPublicStatus } from '../../core/types'
import { requestJson } from './request'
import { loadRawConfig, rawConfig, setRawConfig } from './resource-config'
import { clearCookieBackedData, refreshOverviewSurface } from './resource-state'
import { getErrorMessage, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'
import {
  applyManualPassportSaveResponse,
  applyRawConfig,
  cookieCheck,
  cookieCloud,
  getCookieCloudConfig,
  mainCookie,
  passportCookie,
  passportQrLogin,
  passportQrLoginBusy,
  yubaCookie,
} from './cookie-source-state'

interface SaveCookieCloudOptions {
  forceEnable?: boolean
  forceDisable?: boolean
  quietSuccess?: boolean
  revertActiveTo?: boolean
}

export interface PersistCookieSourceResponse {
  data?: {
    config?: DockerConfig
    effective?: EffectiveCookiePreview
    updated?: boolean
  }
}

interface PassportQrLoginResponse {
  data?: PassportQrLoginPublicStatus | null
}

async function refreshOverviewAfterCookieChange(showSuccessToast: boolean): Promise<void> {
  await refreshOverviewSurface('overview', false)
  if (showSuccessToast) {
    showToast('状态已刷新', true)
  }
}

async function applyPassportQrLoginStatus(status: PassportQrLoginPublicStatus | null): Promise<void> {
  passportQrLogin.value = status
  if (!status?.mainSaved && !status?.yubaSaved) {
    return
  }

  await loadRawConfig()
  applyRawConfig(rawConfig.value)
  clearCookieBackedData()
  cookieCheck.value = null
  await refreshOverviewAfterCookieChange(false)
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
    const data = await requestJson<{ data?: { config?: DockerConfig } }>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manualCookies: {
          main: mainCookie.value.trim(),
          yuba: yubaCookie.value.trim(),
        },
        manualPassport: {
          cookie: nextPassportCookie,
        },
      }),
    })
    if (data.data?.config) {
      applyManualPassportSaveResponse(data.data.config, nextPassportCookie)
    }
    clearCookieBackedData()
    cookieCheck.value = null
    showToast('手填 Cookie 已保存', true)
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return
    }
    showToast(`保存手填 Cookie 失败：${getErrorMessage(error)}`, false)
  }
}

export async function syncCookieCloudToLoginCookies(showSuccessToast?: boolean, rethrowError?: boolean): Promise<PersistCookieSourceResponse | null | undefined> {
  if (!getCookieCloudConfig(rawConfig.value).active) {
    return null
  }

  try {
    const data = await requestJson<PersistCookieSourceResponse>('/api/cookie-source/persist', {
      method: 'POST',
    })
    if (data.data?.config) {
      setRawConfig(data.data.config)
      applyRawConfig(data.data.config)
    }
    if (data.data?.updated) {
      clearCookieBackedData()
    }
    if (showSuccessToast) {
      showToast(data.data?.updated ? 'CookieCloud 已同步到本地登录 Cookie' : '本地登录 Cookie 已是最新同步结果', true)
    }
    return data
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    if (showSuccessToast) {
      showToast(`同步 CookieCloud 到登录 Cookie 失败：${getErrorMessage(error)}`, false)
    }
    if (rethrowError) {
      throw error
    }
    return undefined
  }
}

export async function checkCookieSource(showSuccessToast = true): Promise<CookieDiagnostics | undefined> {
  try {
    await syncCookieCloudToLoginCookies(false, true)
    const data = await requestJson<CookieDiagnostics>('/api/cookie-source/check', {
      method: 'POST',
    })
    cookieCheck.value = data
    if (showSuccessToast !== false) {
      const readyForDyTokenYuba = data.mainCookieReady && data.yubaDyTokenReady
      showToast(readyForDyTokenYuba ? '登录凭证已同步，dy-token 鱼吧请求已就绪' : '登录凭证已同步并校验，请查看缺失项', readyForDyTokenYuba)
    }
    return data
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    cookieCheck.value = null
    showToast(`同步并校验登录凭证失败：${getErrorMessage(error)}`, false)
    return undefined
  }
}

async function saveCookieCloud(options: SaveCookieCloudOptions = {}): Promise<void> {
  if (options.forceEnable) {
    cookieCloud.active = true
  }
  if (options.forceDisable) {
    cookieCloud.active = false
  }
  const shouldEnable = cookieCloud.active

  try {
    const payload = {
      cookieCloud: {
        active: shouldEnable,
        endpoint: cookieCloud.endpoint.trim(),
        uuid: cookieCloud.uuid.trim(),
        cron: cookieCloud.cron.trim(),
        password: cookieCloud.password.trim(),
        cryptoType: 'legacy',
      },
    }
    const data = await requestJson<{ data?: { config?: DockerConfig } }>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    cookieCheck.value = null
    if (data.data?.config) {
      setRawConfig(data.data.config)
      applyRawConfig(data.data.config)
    }
    clearCookieBackedData()
    if (!options.quietSuccess) {
      showToast(shouldEnable ? 'CookieCloud 已保存并启用' : 'CookieCloud 配置已保存', true)
    }
    if (payload.cookieCloud.active) {
      await checkCookieSource(false)
    }
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (options.revertActiveTo !== undefined) {
      cookieCloud.active = options.revertActiveTo
    }
    if (isHttpUnauthorized(error)) {
      return
    }
    showToast(`${shouldEnable ? '保存并启用 CookieCloud 失败：' : '保存 CookieCloud 失败：'}${getErrorMessage(error)}`, false)
  }
}

export function saveCookieCloudToggle(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  return saveCookieCloud({
    revertActiveTo: options?.revertCheckboxOnError ? !cookieCloud.active : undefined,
    quietSuccess: true,
  })
}

export function saveAndEnableCookieCloud(): Promise<void> {
  const previousActive = cookieCloud.active
  return saveCookieCloud({
    forceEnable: true,
    revertActiveTo: previousActive,
  })
}

export function disableCookieCloud(): Promise<void> {
  return saveCookieCloud({
    forceDisable: true,
    revertActiveTo: true,
    quietSuccess: true,
  })
}
