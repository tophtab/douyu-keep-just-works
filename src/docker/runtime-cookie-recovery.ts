import { getCookieValue } from '../core/api'
import { getCookieCloudPassportCookie } from '../core/cookie-cloud'
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
  getManualPassportCookie(): string
  persistManualCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig
  validateMainCookie: CookieSnapshotValidator
  log: CookieRecoveryLogger
}

interface PassportRecoveryMaterial {
  cookie: string
  ltp0: string
  dyDid?: string
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

function readPassportRecoveryMaterial(cookie: string, source: PassportRecoveryMaterial['source']): PassportRecoveryMaterial | null {
  const normalizedCookie = cookie.trim()
  const ltp0 = getCookieValue(normalizedCookie, 'LTP0')
  if (!ltp0) {
    return null
  }

  return {
    cookie: normalizedCookie,
    ltp0,
    dyDid: getCookieValue(normalizedCookie, 'dy_did'),
    source,
  }
}

async function resolvePassportRecoveryMaterial(deps: CredentialSnapshotRecoveryDeps): Promise<PassportRecoveryMaterial | null> {
  const manualPassportCookie = deps.getManualPassportCookie().trim()

  if (deps.hasCookieCloudSource()) {
    const snapshot = await deps.loadCookieCloudSnapshot(false)
    const cookieCloudMaterial = readPassportRecoveryMaterial(getCookieCloudPassportCookie(snapshot.cookies), 'cookieCloud')
    if (cookieCloudMaterial) {
      return cookieCloudMaterial
    }
  }

  if (manualPassportCookie) {
    return readPassportRecoveryMaterial(manualPassportCookie, 'manual')
  }

  return null
}

function ensureCookieHasDyDid(cookie: string, dyDid: string): string {
  if (getCookieValue(cookie, 'dy_did')) {
    return cookie
  }
  return cookie.trim() ? `dy_did=${dyDid}; ${cookie.trim()}` : `dy_did=${dyDid}`
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

  const passportMaterial = await resolvePassportRecoveryMaterial(deps)
  if (!passportMaterial) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: deps.hasCookieCloudSource()
        ? 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0，且手填 passport Cookie 未配置'
        : '手填 passport Cookie 未配置或缺少 LTP0，无法执行 safeAuth',
    }
  }

  const dyDid = passportMaterial.dyDid || getCookieValue(syncedCookie, 'dy_did')
  if (!dyDid) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: 'passport Cookie 和主站 Cookie 均缺少 dy_did，无法执行 safeAuth',
    }
  }

  const safeAuthMainCookie = ensureCookieHasDyDid(syncedCookie, dyDid)
  const safeAuthResult = await refreshDouyuMainCookiesWithSafeAuth({
    mainCookie: safeAuthMainCookie,
    dyDid,
    ltp0: passportMaterial.ltp0,
  })
  deps.log(`safeAuth 已使用${passportMaterial.source === 'cookieCloud' ? 'CookieCloud' : '手填'} passport Cookie 返回主站登录字段: ${safeAuthResult.returnedKeys.join(', ')}`)

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
