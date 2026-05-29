import { getCookieValue } from '../core/api'
import { getCookieCloudPassportLtp0 } from '../core/cookie-cloud'
import type { CookieCloudSnapshot } from '../core/cookie-cloud'
import { refreshDouyuMainCookiesWithSafeAuth } from '../core/douyu-passport'
import type { DockerConfig } from '../core/types'

const LOCAL_MAIN_RECOVERY_REQUIRED_KEYS = [
  'acf_uid',
  'dy_did',
  'acf_auth',
  'acf_stk',
  'acf_ltkid',
  'acf_username',
  'acf_biz',
  'acf_ct',
]

export type CookieSnapshotValidator = (mainCookie: string) => Promise<void>
export type CookieRecoveryLogger = (message: string) => void

export interface CredentialSnapshotRecoveryResult {
  recovered: boolean
  refreshedBy: 'cookieCloud' | 'safeAuth' | null
  reason: string
}

interface PersistedEffectiveCookies {
  config: DockerConfig
  updated: boolean
}

export interface CredentialSnapshotRecoveryDeps {
  hasCookieCloudSource(): boolean
  persistEffectiveCookies(forceRefresh?: boolean): Promise<PersistedEffectiveCookies>
  loadCookieCloudSnapshot(forceRefresh?: boolean): Promise<CookieCloudSnapshot>
  getCurrentYubaCookie(): string
  persistManualCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig
  validateMainCookie: CookieSnapshotValidator
  log: CookieRecoveryLogger
}

async function validateRecoveredMainCookie(mainCookie: string, validateMainCookie: CookieSnapshotValidator): Promise<{
  valid: boolean
  reason: string
}> {
  const missingKeys = LOCAL_MAIN_RECOVERY_REQUIRED_KEYS.filter(name => !getCookieValue(mainCookie, name))
  if (missingKeys.length > 0) {
    return {
      valid: false,
      reason: `主站 Cookie 缺少 ${missingKeys.join(', ')}`,
    }
  }

  try {
    await validateMainCookie(mainCookie)
    return {
      valid: true,
      reason: 'ok',
    }
  } catch (error: unknown) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function recoverCredentialSnapshot(deps: CredentialSnapshotRecoveryDeps): Promise<CredentialSnapshotRecoveryResult> {
  if (!deps.hasCookieCloudSource()) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: 'CookieCloud 未启用',
    }
  }

  const persistResult = await deps.persistEffectiveCookies(true)
  deps.log(persistResult.updated
    ? 'CookieCloud 已同步最新本地登录快照'
    : 'CookieCloud 同步完成，本地登录快照无需更新')

  const syncedCookie = persistResult.config.manualCookies?.main?.trim() || persistResult.config.cookie.trim()
  const syncedValidation = await validateRecoveredMainCookie(syncedCookie, deps.validateMainCookie)
  if (syncedValidation.valid) {
    return {
      recovered: true,
      refreshedBy: 'cookieCloud',
      reason: 'CookieCloud 同步后的主站 Cookie 已通过验证',
    }
  }
  deps.log(`CookieCloud 同步后主站 Cookie 仍不可用: ${syncedValidation.reason}`)

  const dyDid = getCookieValue(syncedCookie, 'dy_did')
  if (!dyDid) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: '缺少 dy_did，无法执行 safeAuth',
    }
  }

  const snapshot = await deps.loadCookieCloudSnapshot(false)
  const ltp0 = getCookieCloudPassportLtp0(snapshot.cookies)
  if (!ltp0) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0',
    }
  }

  const safeAuthResult = await refreshDouyuMainCookiesWithSafeAuth({
    mainCookie: syncedCookie,
    dyDid,
    ltp0,
  })
  deps.log(`safeAuth 已返回主站登录字段: ${safeAuthResult.returnedKeys.join(', ')}`)

  const safeAuthValidation = await validateRecoveredMainCookie(safeAuthResult.refreshedCookie, deps.validateMainCookie)
  if (!safeAuthValidation.valid) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: `safeAuth 后主站 Cookie 仍不可用: ${safeAuthValidation.reason}`,
    }
  }

  const currentYubaCookie = deps.getCurrentYubaCookie() || safeAuthResult.refreshedCookie
  deps.persistManualCookieSnapshot(safeAuthResult.refreshedCookie, currentYubaCookie)

  return {
    recovered: true,
    refreshedBy: 'safeAuth',
    reason: 'safeAuth 刷新后的主站 Cookie 已通过验证',
  }
}
