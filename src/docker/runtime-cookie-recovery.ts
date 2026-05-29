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
  getCurrentMainCookie(): string
  getCurrentYubaCookie(): string
  getManualPassportLtp0(): string
  persistManualCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig
  validateMainCookie: CookieSnapshotValidator
  log: CookieRecoveryLogger
}

interface PassportLtp0Material {
  ltp0: string
  source: 'cookieCloud' | 'manual'
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

async function resolvePassportLtp0Material(deps: CredentialSnapshotRecoveryDeps): Promise<PassportLtp0Material | null> {
  const manualLtp0 = deps.getManualPassportLtp0().trim()

  if (deps.hasCookieCloudSource()) {
    const snapshot = await deps.loadCookieCloudSnapshot(false)
    const cookieCloudLtp0 = getCookieCloudPassportLtp0(snapshot.cookies)
    if (cookieCloudLtp0) {
      return {
        ltp0: cookieCloudLtp0,
        source: 'cookieCloud',
      }
    }
  }

  if (manualLtp0) {
    return {
      ltp0: manualLtp0,
      source: 'manual',
    }
  }

  return null
}

export async function recoverCredentialSnapshot(deps: CredentialSnapshotRecoveryDeps): Promise<CredentialSnapshotRecoveryResult> {
  let syncedCookie = deps.getCurrentMainCookie().trim()
  let syncedByCookieCloud = false

  if (syncedCookie) {
    const localValidation = await validateRecoveredMainCookie(syncedCookie, deps.validateMainCookie)
    if (localValidation.valid) {
      return {
        recovered: true,
        refreshedBy: null,
        reason: '本地主站 Cookie 已通过验证',
      }
    }
    deps.log(`本地主站 Cookie 仍不可用: ${localValidation.reason}`)
  }

  if (deps.hasCookieCloudSource()) {
    const persistResult = await deps.persistEffectiveCookies(true)
    syncedByCookieCloud = true
    deps.log(persistResult.updated
      ? 'CookieCloud 已同步最新本地登录快照'
      : 'CookieCloud 同步完成，本地登录快照无需更新')

    syncedCookie = persistResult.config.manualCookies?.main?.trim() || persistResult.config.cookie.trim()
  }

  if (!syncedCookie.trim()) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: '本地主站 Cookie 为空，无法恢复登录凭证',
    }
  }

  if (syncedByCookieCloud) {
    const syncedValidation = await validateRecoveredMainCookie(syncedCookie, deps.validateMainCookie)
    if (syncedValidation.valid) {
      return {
        recovered: true,
        refreshedBy: 'cookieCloud',
        reason: 'CookieCloud 同步后的主站 Cookie 已通过验证',
      }
    }
    deps.log(`CookieCloud 同步后主站 Cookie 仍不可用: ${syncedValidation.reason}`)
  }

  const dyDid = getCookieValue(syncedCookie, 'dy_did')
  if (!dyDid) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: '主站 Cookie 缺少 dy_did，无法执行 safeAuth',
    }
  }

  const passportLtp0 = await resolvePassportLtp0Material(deps)
  if (!passportLtp0) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: deps.hasCookieCloudSource()
        ? 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0，且手填 passport/LTP0 未配置'
        : '手填 passport/LTP0 未配置，无法执行 safeAuth',
    }
  }

  const safeAuthResult = await refreshDouyuMainCookiesWithSafeAuth({
    mainCookie: syncedCookie,
    dyDid,
    ltp0: passportLtp0.ltp0,
  })
  deps.log(`safeAuth 已使用${passportLtp0.source === 'cookieCloud' ? 'CookieCloud' : '手填'} passport/LTP0 返回主站登录字段: ${safeAuthResult.returnedKeys.join(', ')}`)

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
