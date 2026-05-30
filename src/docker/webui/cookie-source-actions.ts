import type { CookieDiagnostics, DockerConfig, EffectiveCookiePreview } from '../../core/types'
import { requestJson } from './request'
import { rawConfig, setRawConfig } from './resource-config'
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

async function refreshOverviewAfterCookieChange(showSuccessToast: boolean): Promise<void> {
  await refreshOverviewSurface('overview', false)
  if (showSuccessToast) {
    showToast('状态已刷新', true)
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
