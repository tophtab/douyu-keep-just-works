import { getCookieValue } from '../core/api'
import { getCookieCloudPassportCookie } from '../core/cookie-cloud'
import type { CookieCloudSnapshot } from '../core/cookie-cloud'
import { fetchDouyuYubaCookiesWithPassport, refreshDouyuMainCookiesWithSafeAuth } from '../core/douyu-passport'
import { errorMessage } from '../core/errors'
import type { DockerConfig } from '../core/types'
import { isCookieCredentialMessage } from './server-errors'

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
  recoverYubaCookie?: boolean
}

export interface DockerRuntimeCookieRecoveryDeps {
  hasPassportRecoveryMaterial: () => boolean
  recoverCredentialSnapshot: (options: {
    validateMainCookie: CookieSnapshotValidator
    log: CookieRecoveryLogger
    recoverYubaCookie?: boolean
  }) => Promise<CredentialSnapshotRecoveryResult>
  validateMainCookie: CookieSnapshotValidator
  logSystem: CookieRecoveryLogger
}

interface PassportRecoveryMaterial {
  cookie: string
  ltp0: string
  dyDid?: string
  source: 'cookieCloud' | 'manual'
}

function shouldRecoverYubaCookie(message: string, context: string): boolean {
  return context.includes('鱼吧')
    || message.includes('鱼吧')
    || message.includes('acf_yb_t')
    || message.includes('dy-token')
}

export class DockerRuntimeCookieRecoveryService {
  constructor(private readonly deps: DockerRuntimeCookieRecoveryDeps) {}

  async refreshCookieSourceAfterFailure(error: unknown, context: string): Promise<boolean> {
    const message = errorMessage(error)
    if (!isCookieCredentialMessage(message) || !this.deps.hasPassportRecoveryMaterial()) {
      return false
    }

    try {
      this.deps.logSystem(`${context}检测到登录凭证可能失效，正在尝试恢复后重试`)
      const result = await this.deps.recoverCredentialSnapshot({
        validateMainCookie: this.deps.validateMainCookie,
        log: this.deps.logSystem,
        recoverYubaCookie: shouldRecoverYubaCookie(message, context),
      })
      this.deps.logSystem(result.reason)
      return result.recovered
    } catch (syncError: unknown) {
      this.deps.logSystem(`登录凭证恢复失败: ${errorMessage(syncError)}`)
      return false
    }
  }

  async runWithCookieSourceRetry<T>(context: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error: unknown) {
      const refreshed = await this.refreshCookieSourceAfterFailure(error, context)
      if (!refreshed) {
        throw error
      }
      return await run()
    }
  }
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

async function recoverYubaCookieWithPassport(deps: CredentialSnapshotRecoveryDeps, passportMaterial: PassportRecoveryMaterial, mainCookie: string): Promise<{
  recovered: boolean
  yubaCookie: string
  reason: string
}> {
  const dyDid = passportMaterial.dyDid || getCookieValue(mainCookie, 'dy_did')
  const passportCookie = dyDid ? ensureCookieHasDyDid(passportMaterial.cookie, dyDid) : passportMaterial.cookie

  try {
    const yubaResult = await fetchDouyuYubaCookiesWithPassport({
      passportCookie,
      mainCookie,
    })
    deps.log(`鱼吧 SSO 已使用${passportMaterial.source === 'cookieCloud' ? 'CookieCloud' : '手填'} passport Cookie 返回鱼吧登录字段: ${yubaResult.returnedKeys.join(', ')}`)
    return {
      recovered: true,
      yubaCookie: yubaResult.yubaCookie,
      reason: '鱼吧 SSO 刷新后的鱼吧 Cookie 已通过字段校验',
    }
  } catch (error: unknown) {
    return {
      recovered: false,
      yubaCookie: deps.getCurrentYubaCookie() || mainCookie,
      reason: `鱼吧 SSO 恢复失败，保留当前鱼吧 Cookie: ${errorMessage(error)}`,
    }
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

interface MainCookieStageResult {
  mainCookie: string
  result: CredentialSnapshotRecoveryResult | null
}

interface RefreshedMainCookieStageResult extends MainCookieStageResult {
  passportMaterial: PassportRecoveryMaterial | null
  refreshedBy: CredentialSnapshotRecoveryResult['refreshedBy']
}

async function validateLocalMainCookieStage(
  deps: CredentialSnapshotRecoveryDeps,
  shouldRecoverYuba: boolean,
): Promise<MainCookieStageResult> {
  const mainCookie = deps.getCurrentMainCookie().trim()
  if (!mainCookie) {
    return { mainCookie: '', result: null }
  }

  const validation = await validateRecoveredMainCookie(mainCookie, deps.validateMainCookie)
  if (!validation.valid) {
    deps.log(`本地主站 Cookie 仍不可用: ${validation.reason}`)
    return { mainCookie: '', result: null }
  }

  return {
    mainCookie,
    result: shouldRecoverYuba
      ? null
      : {
          recovered: true,
          refreshedBy: null,
          reason: '本地主站 Cookie 已通过验证',
        },
  }
}

async function refreshMainCookieFromCookieCloudStage(
  deps: CredentialSnapshotRecoveryDeps,
  shouldRecoverYuba: boolean,
): Promise<RefreshedMainCookieStageResult> {
  const persistResult = await deps.persistEffectiveCookies(true)
  deps.log(persistResult.updated
    ? 'CookieCloud 已同步最新本地登录快照'
    : 'CookieCloud 同步完成，本地登录快照无需更新')

  const mainCookie = persistResult.config.manualCookies?.main?.trim() || persistResult.config.cookie.trim()
  const validation = await validateRecoveredMainCookie(mainCookie, deps.validateMainCookie)
  if (!validation.valid) {
    deps.log(`CookieCloud 同步后主站 Cookie 仍不可用: ${validation.reason}`)
    return {
      mainCookie: '',
      passportMaterial: null,
      refreshedBy: null,
      result: null,
    }
  }

  const refreshedBy = 'cookieCloud' as const
  return {
    mainCookie,
    passportMaterial: null,
    refreshedBy,
    result: shouldRecoverYuba
      ? null
      : {
          recovered: true,
          refreshedBy,
          reason: 'CookieCloud 同步后的主站 Cookie 已通过验证',
        },
  }
}

async function refreshMainCookieWithPassportStage(deps: CredentialSnapshotRecoveryDeps): Promise<RefreshedMainCookieStageResult> {
  const passportMaterial = await resolvePassportRecoveryMaterial(deps)
  if (!passportMaterial) {
    return {
      mainCookie: '',
      passportMaterial: null,
      refreshedBy: null,
      result: {
        recovered: false,
        refreshedBy: null,
        reason: deps.hasCookieCloudSource()
          ? 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0，且手填 passport Cookie 未配置'
          : '手填 passport Cookie 未配置或缺少 LTP0，无法执行 safeAuth',
      },
    }
  }

  const dyDid = passportMaterial.dyDid || getCookieValue(deps.getCurrentMainCookie(), 'dy_did')
  if (!dyDid) {
    return {
      mainCookie: '',
      passportMaterial,
      refreshedBy: null,
      result: {
        recovered: false,
        refreshedBy: null,
        reason: 'passport Cookie 和主站 Cookie 均缺少 dy_did，无法执行 safeAuth',
      },
    }
  }

  const safeAuthResult = await refreshDouyuMainCookiesWithSafeAuth({
    mainCookie: ensureCookieHasDyDid(deps.getCurrentMainCookie().trim(), dyDid),
    dyDid,
    ltp0: passportMaterial.ltp0,
  })
  deps.log(`safeAuth 已使用${passportMaterial.source === 'cookieCloud' ? 'CookieCloud' : '手填'} passport Cookie 返回主站登录字段: ${safeAuthResult.returnedKeys.join(', ')}`)

  const validation = await validateRecoveredMainCookie(safeAuthResult.refreshedCookie, deps.validateMainCookie)
  if (!validation.valid) {
    return {
      mainCookie: '',
      passportMaterial,
      refreshedBy: null,
      result: {
        recovered: false,
        refreshedBy: null,
        reason: `safeAuth 后主站 Cookie 仍不可用: ${validation.reason}`,
      },
    }
  }

  return {
    mainCookie: safeAuthResult.refreshedCookie,
    passportMaterial,
    refreshedBy: 'safeAuth',
    result: null,
  }
}

async function completeYubaRecoveryStage(
  deps: CredentialSnapshotRecoveryDeps,
  mainCookie: string,
  refreshedBy: CredentialSnapshotRecoveryResult['refreshedBy'],
  existingPassportMaterial: PassportRecoveryMaterial | null,
): Promise<CredentialSnapshotRecoveryResult> {
  const passportMaterial = existingPassportMaterial || await resolvePassportRecoveryMaterial(deps)
  if (!passportMaterial) {
    if (!refreshedBy) {
      return {
        recovered: false,
        refreshedBy: null,
        reason: deps.hasCookieCloudSource()
          ? 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0，且手填 passport Cookie 未配置，无法执行鱼吧 SSO'
          : '手填 passport Cookie 未配置或缺少 LTP0，无法执行鱼吧 SSO',
      }
    }
    const currentYubaCookie = deps.getCurrentYubaCookie() || mainCookie
    deps.persistManualCookieSnapshot(mainCookie, currentYubaCookie)
    return {
      recovered: true,
      refreshedBy,
      reason: `${refreshedBy === 'cookieCloud' ? 'CookieCloud 同步后的' : 'safeAuth 刷新后的'}主站 Cookie 已通过验证；无法执行鱼吧 SSO: ${deps.hasCookieCloudSource() ? 'CookieCloud 的 passport.douyu.com 快照缺少 LTP0，且手填 passport Cookie 未配置' : '手填 passport Cookie 未配置或缺少 LTP0'}`,
    }
  }

  const yubaRecovery = await recoverYubaCookieWithPassport(deps, passportMaterial, mainCookie)
  deps.log(yubaRecovery.reason)
  if (!yubaRecovery.recovered && !refreshedBy) {
    return {
      recovered: false,
      refreshedBy: null,
      reason: yubaRecovery.reason,
    }
  }

  deps.persistManualCookieSnapshot(mainCookie, yubaRecovery.yubaCookie)
  return {
    recovered: true,
    refreshedBy,
    reason: yubaRecovery.recovered
      ? `${refreshedBy === 'cookieCloud' ? 'CookieCloud 同步后的' : refreshedBy === 'safeAuth' ? 'safeAuth 刷新后的' : '本地'}主站 Cookie 已通过验证，且鱼吧 SSO 已刷新鱼吧 Cookie`
      : `${refreshedBy === 'cookieCloud' ? 'CookieCloud 同步后的' : 'safeAuth 刷新后的'}主站 Cookie 已通过验证；${yubaRecovery.reason}`,
  }
}

function completeMainRecoveryStage(
  deps: CredentialSnapshotRecoveryDeps,
  mainCookie: string,
  refreshedBy: CredentialSnapshotRecoveryResult['refreshedBy'],
): CredentialSnapshotRecoveryResult {
  const currentYubaCookie = deps.getCurrentYubaCookie() || mainCookie
  deps.persistManualCookieSnapshot(mainCookie, currentYubaCookie)
  return {
    recovered: true,
    refreshedBy,
    reason: refreshedBy === 'safeAuth' ? 'safeAuth 刷新后的主站 Cookie 已通过验证' : '本地主站 Cookie 已通过验证',
  }
}

export async function recoverCredentialSnapshot(deps: CredentialSnapshotRecoveryDeps): Promise<CredentialSnapshotRecoveryResult> {
  const shouldRecoverYuba = deps.recoverYubaCookie === true
  const localStage = await validateLocalMainCookieStage(deps, shouldRecoverYuba)
  if (localStage.result) {
    return localStage.result
  }

  let mainCookie = localStage.mainCookie
  let refreshedBy: CredentialSnapshotRecoveryResult['refreshedBy'] = null
  let passportMaterial: PassportRecoveryMaterial | null = null

  if (!mainCookie && deps.hasCookieCloudSource()) {
    const cookieCloudStage = await refreshMainCookieFromCookieCloudStage(deps, shouldRecoverYuba)
    if (cookieCloudStage.result) {
      return cookieCloudStage.result
    }
    mainCookie = cookieCloudStage.mainCookie
    refreshedBy = cookieCloudStage.refreshedBy
  }

  if (!mainCookie) {
    const passportStage = await refreshMainCookieWithPassportStage(deps)
    if (passportStage.result) {
      return passportStage.result
    }
    mainCookie = passportStage.mainCookie
    refreshedBy = passportStage.refreshedBy
    passportMaterial = passportStage.passportMaterial
  }

  if (shouldRecoverYuba) {
    return await completeYubaRecoveryStage(deps, mainCookie, refreshedBy, passportMaterial)
  }

  return completeMainRecoveryStage(deps, mainCookie, refreshedBy)
}
