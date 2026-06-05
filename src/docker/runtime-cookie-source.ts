import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { parseCookieRecord } from '../core/api'
import { buildCookieHeaderForUrl, createCookieDiagnostics, fetchCookieCloudSnapshot, getCookieCloudPassportCookie, isCookieCloudReady } from '../core/cookie-cloud'
import { createDouyuPassportDeviceCookie, fetchDouyuMainCookiesFromLoginUrl, fetchDouyuYubaCookiesWithPassport, generateDouyuPassportQrChallenge, pollDouyuPassportQrAuth } from '../core/douyu-passport'
import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, EffectiveCookiePreview, PassportQrLoginPublicStatus, PassportQrLoginStatus } from '../core/types'
import { buildConfigWithPartialUpdate, configsEqual, saveConfigToDisk } from './config-store'
import { recoverCredentialSnapshot as recoverCredentialSnapshotWithDeps } from './runtime-cookie-recovery'
import type { CookieRecoveryLogger, CookieSnapshotValidator, CredentialSnapshotRecoveryResult } from './runtime-cookie-recovery'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'

const COOKIE_CLOUD_CACHE_TTL_MS = 60 * 1000
const PASSPORT_QR_IMAGE_SIZE = 240
const COMPLETE_MAIN_COOKIE_KEYS = ['acf_uid', 'dy_did', 'acf_auth', 'acf_stk', 'acf_ltkid', 'acf_biz', 'acf_ct']
const COMPLETE_YUBA_COOKIE_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t']

interface CookieCloudCacheEntry {
  key: string
  fetchedAt: number
  snapshot: Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>
}

interface EffectiveCookieMaterial {
  effective: EffectiveCookiePreview
  manualPassportCookie?: string
}

interface PassportQrLoginSession {
  id: string
  code: string
  expiresAt: number
  qrImageDataUrl?: string
  status: PassportQrLoginStatus
  message: string
  passportCookie?: string
  loginUrl?: string
  mainCookie?: string
  yubaCookie?: string
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cookieHasKeys(cookie: string, keys: string[]): boolean {
  const record = parseCookieRecord(cookie)
  return keys.every(name => Boolean(record[name]))
}

function shouldUseSourceCookie(sourceCookie: string, currentCookie: string, requiredKeys: string[]): boolean {
  if (!sourceCookie) {
    return false
  }
  if (!currentCookie) {
    return true
  }
  return !(cookieHasKeys(currentCookie, requiredKeys) && !cookieHasKeys(sourceCookie, requiredKeys))
}

function isTerminalPassportQrStatus(status: PassportQrLoginStatus): boolean {
  return ['yuba_saved', 'yuba_failed', 'expired', 'cancelled', 'failed'].includes(status)
}

export class DockerCookieSourceManager {
  private cookieCloudCache: CookieCloudCacheEntry | null = null
  private passportQrLoginSession: PassportQrLoginSession | null = null

  constructor(
    private readonly getConfig: () => DockerConfig | null,
    private readonly setConfig: (config: DockerConfig) => void,
    private readonly getConfigPath: () => string,
    private readonly applyConfig: (config: DockerConfig, reason: 'cookie_saved') => void,
    private readonly clearFansListCache: () => void,
    private readonly invalidateStatusCaches: (scope: StatusCacheScope) => void,
  ) {}

  hasManualCookie(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return Boolean(
      config?.manualCookies?.main?.trim()
      || config?.manualCookies?.yuba?.trim()
      || config?.cookie?.trim(),
    )
  }

  hasCookieCloudSource(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return isCookieCloudReady(config?.cookieCloud)
  }

  hasManualPassport(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return Boolean(config?.manualPassport?.cookie?.trim())
  }

  hasPassportRecoveryMaterial(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return this.hasCookieCloudSource(config) || this.hasManualPassport(config)
  }

  hasConfiguredCookieSource(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return this.hasManualCookie(config) || this.hasCookieCloudSource(config)
  }

  clearCookieCloudCache(): void {
    this.cookieCloudCache = null
  }

  async startPassportQrLogin(): Promise<PassportQrLoginPublicStatus> {
    const passportCookie = createDouyuPassportDeviceCookie()
    const challenge = await generateDouyuPassportQrChallenge(Date.now(), passportCookie)
    const qrImageDataUrl = await QRCode.toDataURL(challenge.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: PASSPORT_QR_IMAGE_SIZE,
    })
    this.passportQrLoginSession = {
      id: randomUUID(),
      code: challenge.code,
      expiresAt: challenge.expiresAt,
      qrImageDataUrl,
      status: 'waiting',
      message: '等待扫码',
      passportCookie,
    }
    return this.toPassportQrPublicStatus(this.passportQrLoginSession)
  }

  getPassportQrLoginStatus(): PassportQrLoginPublicStatus | null {
    const session = this.passportQrLoginSession
    if (!session) {
      return null
    }
    this.markPassportQrExpiredIfNeeded(session)
    return this.toPassportQrPublicStatus(session)
  }

  async pollPassportQrLogin(): Promise<PassportQrLoginPublicStatus> {
    const session = this.passportQrLoginSession
    if (!session) {
      throw new Error('扫码登录会话不存在')
    }
    this.markPassportQrExpiredIfNeeded(session)
    if (isTerminalPassportQrStatus(session.status)) {
      return this.toPassportQrPublicStatus(session)
    }

    try {
      if (session.status === 'waiting' || session.status === 'scanned') {
        const pollResult = await pollDouyuPassportQrAuth(session.code, session.passportCookie || '')
        if (pollResult.status === 'waiting' || pollResult.status === 'scanned') {
          session.status = pollResult.status
          session.message = pollResult.status === 'scanned' ? '已扫码，等待确认' : '等待扫码'
          return this.toPassportQrPublicStatus(session)
        }
        if (pollResult.status === 'expired' || pollResult.status === 'cancelled' || pollResult.status === 'failed') {
          session.status = pollResult.status
          session.message = pollResult.message
          return this.toPassportQrPublicStatus(session)
        }

        session.status = 'passport_confirmed'
        session.message = 'passport 已确认，正在获取主站登录态'
        session.passportCookie = pollResult.passportCookie
        session.loginUrl = pollResult.loginUrl
        return this.toPassportQrPublicStatus(session)
      }

      if (session.status === 'passport_confirmed') {
        await this.completePassportQrMainSnapshot(session)
        return this.toPassportQrPublicStatus(session)
      }

      if (session.status === 'main_saved') {
        await this.completePassportQrYubaSnapshot(session)
        return this.toPassportQrPublicStatus(session)
      }
    } catch (error: unknown) {
      session.status = 'failed'
      session.message = '扫码登录失败'
      session.error = errorMessage(error)
    }

    return this.toPassportQrPublicStatus(session)
  }

  cancelPassportQrLogin(): PassportQrLoginPublicStatus | null {
    const session = this.passportQrLoginSession
    if (!session) {
      return null
    }
    if (!isTerminalPassportQrStatus(session.status)) {
      session.status = 'cancelled'
      session.message = '扫码登录已取消'
    }
    return this.toPassportQrPublicStatus(session)
  }

  async retryPassportQrLoginYuba(): Promise<PassportQrLoginPublicStatus> {
    const currentSession = this.passportQrLoginSession
    const passportCookie = currentSession?.passportCookie || this.getManualPassportCookie()
    const mainCookie = currentSession?.mainCookie || this.getManualCookieForUrl(MAIN_DOUYU_URL, this.getConfig())
    if (!passportCookie || !mainCookie) {
      throw new Error('鱼吧重试缺少已保存的 passport 或主站登录态')
    }

    const session: PassportQrLoginSession = currentSession || {
      id: randomUUID(),
      code: '',
      expiresAt: Date.now(),
      status: 'main_saved',
      message: '主站已保存，正在获取鱼吧登录态',
      passportCookie,
      mainCookie,
    }
    this.passportQrLoginSession = session
    session.status = 'main_saved'
    session.message = '主站已保存，正在获取鱼吧登录态'
    session.error = undefined

    try {
      await this.completePassportQrYubaSnapshot(session)
    } catch (error: unknown) {
      session.status = 'yuba_failed'
      session.message = '鱼吧登录态获取失败，可重试'
      session.error = errorMessage(error)
    }

    return this.toPassportQrPublicStatus(session)
  }

  resolveCookieForUrlFromConfig(targetUrl: string, config: DockerConfig | null | undefined): string {
    const manualCookie = this.getManualCookieForUrl(targetUrl, config)

    if (manualCookie) {
      return manualCookie
    }

    if (this.hasCookieCloudSource(config)) {
      throw new Error(`CookieCloud 已启用，但 ${new URL(targetUrl).hostname} 的本地登录快照为空，请先同步 CookieCloud`)
    }

    throw new Error('请先配置 cookie')
  }

  resolveCookieForUrl(targetUrl: string): string {
    return this.resolveCookieForUrlFromConfig(targetUrl, this.getConfig())
  }

  async getEffectiveCookies(forceRefresh = false): Promise<EffectiveCookiePreview> {
    return (await this.resolveEffectiveCookieMaterial(forceRefresh)).effective
  }

  private async resolveEffectiveCookieMaterial(forceRefresh = false): Promise<EffectiveCookieMaterial> {
    const currentConfig = this.getConfig()
    let mainCookie = this.getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
    let yubaCookie = this.getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
    let source: EffectiveCookiePreview['source'] = this.hasManualCookie(currentConfig) ? 'manual' : 'none'
    let passportLtp0Present: boolean | undefined
    let manualPassportCookie: string | undefined

    if (this.hasCookieCloudSource(currentConfig)) {
      const snapshot = await this.loadCookieCloudSnapshot(forceRefresh)
      const cloudMainCookie = buildCookieHeaderForUrl(snapshot.cookies, MAIN_DOUYU_URL)
      const cloudYubaCookie = buildCookieHeaderForUrl(snapshot.cookies, YUBA_DOUYU_URL)
      const cloudPassportCookie = getCookieCloudPassportCookie(snapshot.cookies).trim()
      passportLtp0Present = Boolean(parseCookieRecord(cloudPassportCookie).LTP0)
      if (passportLtp0Present) {
        manualPassportCookie = cloudPassportCookie
      }

      if (cloudMainCookie || cloudYubaCookie) {
        if (shouldUseSourceCookie(cloudMainCookie, mainCookie, COMPLETE_MAIN_COOKIE_KEYS)) {
          mainCookie = cloudMainCookie
        }
        if (shouldUseSourceCookie(cloudYubaCookie, yubaCookie, COMPLETE_YUBA_COOKIE_KEYS)) {
          yubaCookie = cloudYubaCookie
        }
        yubaCookie = yubaCookie || mainCookie
        source = this.hasManualCookie(currentConfig) ? 'hybrid' : 'cookieCloud'
      }
    }

    if (!mainCookie && !yubaCookie) {
      throw new Error('请先配置 cookie')
    }

    const resolvedYubaCookie = yubaCookie || mainCookie
    const latestConfig = this.getConfig()
    const localPassportCookie = latestConfig?.manualPassport?.cookie?.trim() || ''
    const persistedLocally = latestConfig?.manualCookies?.main?.trim() === mainCookie
      && latestConfig?.manualCookies?.yuba?.trim() === resolvedYubaCookie
      && (!manualPassportCookie || localPassportCookie === manualPassportCookie)

    return {
      effective: {
        source,
        mainCookie,
        yubaCookie: resolvedYubaCookie,
        cookieCloudActive: this.hasCookieCloudSource(latestConfig),
        persistedLocally,
        passportLtp0Present,
      },
      manualPassportCookie,
    }
  }

  async persistEffectiveCookies(forceRefresh = false, options: {
    reloadJobs?: boolean
  } = {}): Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }> {
    const { effective, manualPassportCookie } = await this.resolveEffectiveCookieMaterial(forceRefresh)
    const nextConfig = buildConfigWithPartialUpdate(this.getConfig(), {
      manualCookies: {
        main: effective.mainCookie.trim(),
        yuba: effective.yubaCookie.trim(),
      },
      ...(manualPassportCookie
        ? { manualPassport: { cookie: manualPassportCookie } }
        : {}),
    })

    if (configsEqual(this.getConfig(), nextConfig)) {
      return {
        config: nextConfig,
        effective,
        updated: false,
      }
    }

    saveConfigToDisk(this.getConfigPath(), nextConfig)
    if (options.reloadJobs) {
      this.applyConfig(nextConfig, 'cookie_saved')
    } else {
      this.setConfig(nextConfig)
      this.clearFansListCache()
      this.invalidateStatusCaches('all')
    }

    return {
      config: nextConfig,
      effective,
      updated: true,
    }
  }

  async recoverCredentialSnapshot(options: {
    validateMainCookie: CookieSnapshotValidator
    log: CookieRecoveryLogger
  }): Promise<CredentialSnapshotRecoveryResult> {
    return await recoverCredentialSnapshotWithDeps({
      ...options,
      hasCookieCloudSource: () => this.hasCookieCloudSource(),
      persistEffectiveCookies: async forceRefresh => await this.persistEffectiveCookies(forceRefresh),
      loadCookieCloudSnapshot: async forceRefresh => await this.loadCookieCloudSnapshot(forceRefresh),
      getCurrentMainCookie: () => this.getManualCookieForUrl(MAIN_DOUYU_URL, this.getConfig()),
      getCurrentYubaCookie: () => this.getManualCookieForUrl(YUBA_DOUYU_URL, this.getConfig()),
      getManualPassportCookie: () => this.getManualPassportCookie(),
      persistManualCookieSnapshot: (mainCookie, yubaCookie) => this.persistManualCookieSnapshot(mainCookie, yubaCookie),
    })
  }

  async inspectCookieSource(): Promise<CookieDiagnostics> {
    const currentConfig = this.getConfig()
    if (this.hasManualCookie(currentConfig)) {
      const mainCookie = this.getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
      const yubaCookie = this.getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
      return createCookieDiagnostics(this.hasCookieCloudSource(currentConfig) ? 'cookieCloud' : 'manual', mainCookie, yubaCookie, {
        cookieCount: Object.keys({
          ...parseCookieRecord(mainCookie),
          ...parseCookieRecord(yubaCookie),
        }).length,
        domains: ['local'],
        passportLtp0Present: parseCookieRecord(this.getManualPassportCookie()).LTP0 ? true : undefined,
      })
    }

    if (this.hasCookieCloudSource(currentConfig)) {
      throw new Error('CookieCloud 已启用，但本地登录快照为空，请先同步 CookieCloud')
    }

    throw new Error('请先配置 cookie')
  }

  private markPassportQrExpiredIfNeeded(session: PassportQrLoginSession): void {
    if ((session.status === 'waiting' || session.status === 'scanned') && Date.now() >= session.expiresAt) {
      session.status = 'expired'
      session.message = '扫码登录已过期'
    }
  }

  private toPassportQrPublicStatus(session: PassportQrLoginSession): PassportQrLoginPublicStatus {
    const passportSaved = Boolean(parseCookieRecord(session.passportCookie || '').LTP0)
    const mainSaved = Boolean(session.mainCookie)
    const yubaSaved = Boolean(session.yubaCookie) || session.status === 'yuba_saved'
    const canRetryYuba = session.status === 'yuba_failed' && passportSaved && mainSaved
    const showQrImage = (session.status === 'waiting' || session.status === 'scanned') && Boolean(session.qrImageDataUrl)

    return {
      sessionId: session.id,
      status: session.status,
      message: session.message,
      expiresAt: session.expiresAt,
      ...(showQrImage ? { qrImageDataUrl: session.qrImageDataUrl } : {}),
      passportSaved,
      mainSaved,
      yubaSaved,
      canRetryYuba,
      finished: isTerminalPassportQrStatus(session.status),
      ...(session.error ? { error: session.error } : {}),
    }
  }

  private async completePassportQrMainSnapshot(session: PassportQrLoginSession): Promise<void> {
    if (!session.passportCookie || !session.loginUrl) {
      throw new Error('扫码登录缺少 passport 或主站登录地址')
    }

    const mainResult = await fetchDouyuMainCookiesFromLoginUrl({
      loginUrl: session.loginUrl,
      mainCookie: this.getManualCookieForUrl(MAIN_DOUYU_URL, this.getConfig()),
      passportCookie: session.passportCookie,
    })
    session.mainCookie = mainResult.refreshedCookie
    this.persistPassportQrCookieSnapshot({
      passportCookie: session.passportCookie,
      mainCookie: session.mainCookie,
    })
    session.status = 'main_saved'
    session.message = '主站已保存，正在获取鱼吧登录态'
  }

  private async completePassportQrYubaSnapshot(session: PassportQrLoginSession): Promise<void> {
    if (!session.passportCookie || !session.mainCookie) {
      throw new Error('鱼吧 SSO 缺少 passport 或主站登录态')
    }

    try {
      const yubaResult = await fetchDouyuYubaCookiesWithPassport({
        passportCookie: session.passportCookie,
        mainCookie: session.mainCookie,
        yubaCookie: this.getManualCookieForUrl(YUBA_DOUYU_URL, this.getConfig()),
      })
      session.yubaCookie = yubaResult.yubaCookie
      this.persistPassportQrCookieSnapshot({
        passportCookie: session.passportCookie,
        mainCookie: session.mainCookie,
        yubaCookie: session.yubaCookie,
      })
      session.status = 'yuba_saved'
      session.message = '登录快照已保存'
    } catch (error: unknown) {
      session.status = 'yuba_failed'
      session.message = '鱼吧登录态获取失败，可重试'
      session.error = errorMessage(error)
    }
  }

  private persistPassportQrCookieSnapshot(args: {
    passportCookie: string
    mainCookie: string
    yubaCookie?: string
  }): DockerConfig {
    const currentYubaCookie = this.getConfig()?.manualCookies?.yuba?.trim() || ''
    const nextConfig = buildConfigWithPartialUpdate(this.getConfig(), {
      manualCookies: {
        main: args.mainCookie.trim(),
        yuba: args.yubaCookie?.trim() || currentYubaCookie,
      },
      manualPassport: {
        cookie: args.passportCookie.trim(),
      },
    })

    if (!configsEqual(this.getConfig(), nextConfig)) {
      saveConfigToDisk(this.getConfigPath(), nextConfig)
      this.applyConfig(nextConfig, 'cookie_saved')
    } else {
      this.setConfig(nextConfig)
      this.clearFansListCache()
      this.invalidateStatusCaches('all')
    }
    return nextConfig
  }

  private persistManualCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig {
    const nextConfig = buildConfigWithPartialUpdate(this.getConfig(), {
      manualCookies: {
        main: mainCookie.trim(),
        yuba: yubaCookie.trim(),
      },
    })

    if (!configsEqual(this.getConfig(), nextConfig)) {
      saveConfigToDisk(this.getConfigPath(), nextConfig)
    }
    this.setConfig(nextConfig)
    this.clearFansListCache()
    this.invalidateStatusCaches('all')
    return nextConfig
  }

  private async loadCookieCloudSnapshot(forceRefresh = false): Promise<Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>> {
    const config = this.getConfig()?.cookieCloud
    if (!config || !this.hasCookieCloudSource(this.getConfig())) {
      throw new Error('CookieCloud 配置不完整')
    }

    const cacheKey = this.getCookieCloudCacheKey(config)
    if (
      !forceRefresh
      && this.cookieCloudCache
      && this.cookieCloudCache.key === cacheKey
      && (Date.now() - this.cookieCloudCache.fetchedAt) < COOKIE_CLOUD_CACHE_TTL_MS
    ) {
      return this.cookieCloudCache.snapshot
    }

    const snapshot = await fetchCookieCloudSnapshot(config)
    this.cookieCloudCache = {
      key: cacheKey,
      fetchedAt: Date.now(),
      snapshot,
    }
    return snapshot
  }

  private getCookieCloudCacheKey(config: CookieCloudConfig): string {
    return [config.endpoint, config.uuid, config.password, config.cryptoType || 'legacy'].join('|')
  }

  private getManualPassportCookie(): string {
    return this.getConfig()?.manualPassport?.cookie?.trim() || ''
  }

  private getManualCookieForUrl(targetUrl: string, config: DockerConfig | null | undefined): string {
    const hostname = new URL(targetUrl).hostname
    const mainCookie = config?.manualCookies?.main?.trim() || config?.cookie?.trim() || ''
    const yubaCookie = config?.manualCookies?.yuba?.trim() || ''

    if (hostname === 'yuba.douyu.com') {
      return yubaCookie || mainCookie
    }

    return mainCookie
  }
}
