import { parseCookieRecord } from '../core/api'
import { createCookieDiagnostics } from '../core/cookie-cloud'
import type { CookieDiagnostics, DockerConfig, EffectiveCookiePreview, PassportQrLoginPublicStatus } from '../core/types'
import { DockerCookieCloudCache } from './runtime-cookie-cloud-cache'
import type { CookieCloudSnapshot } from './runtime-cookie-cloud-cache'
import { DockerCookieSnapshotStore } from './runtime-cookie-snapshot-store'
import { recoverCredentialSnapshot as recoverCredentialSnapshotWithDeps } from './runtime-cookie-recovery'
import type { CookieRecoveryLogger, CookieSnapshotValidator, CredentialSnapshotRecoveryResult } from './runtime-cookie-recovery'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { DockerEffectiveCookieResolver, getLocalCookieForUrl, hasConfiguredCookieSource, hasCookieCloudSource, hasLocalLoginCookies, hasLocalPassportCookie, hasPassportRecoveryMaterial, resolveCookieForUrlFromConfig } from './runtime-effective-cookies'
import { DockerPassportQrLoginService } from './runtime-passport-qr-login'

interface DockerCookieSourceManagerDeps {
  getConfig: () => DockerConfig | null
  setConfig: (config: DockerConfig) => void
  getConfigPath: () => string
  applyConfig: (config: DockerConfig, reason: 'cookie_saved') => void
  clearFansListCache: () => void
  invalidateStatusCaches: (scope: StatusCacheScope) => void
}

export class DockerCookieSourceManager {
  private readonly cookieCloudCache: DockerCookieCloudCache
  private readonly cookieSnapshotStore: DockerCookieSnapshotStore
  private readonly effectiveCookieResolver: DockerEffectiveCookieResolver
  private readonly passportQrLogin: DockerPassportQrLoginService

  constructor(private readonly deps: DockerCookieSourceManagerDeps) {
    this.cookieCloudCache = new DockerCookieCloudCache(this.deps.getConfig)
    this.cookieSnapshotStore = new DockerCookieSnapshotStore({
      getConfig: this.deps.getConfig,
      setConfig: this.deps.setConfig,
      getConfigPath: this.deps.getConfigPath,
      applyConfig: this.deps.applyConfig,
      clearFansListCache: this.deps.clearFansListCache,
      invalidateStatusCaches: this.deps.invalidateStatusCaches,
    })
    this.effectiveCookieResolver = new DockerEffectiveCookieResolver({
      getConfig: this.deps.getConfig,
      loadCookieCloudSnapshot: async forceRefresh => await this.loadCookieCloudSnapshot(forceRefresh),
    })
    this.passportQrLogin = new DockerPassportQrLoginService({
      getCurrentMainCookie: () => getLocalCookieForUrl(MAIN_DOUYU_URL, this.deps.getConfig()),
      getCurrentYubaCookie: () => getLocalCookieForUrl(YUBA_DOUYU_URL, this.deps.getConfig()),
      getManualPassportCookie: () => this.getPassportCookie(),
      persistCookieSnapshot: args => this.cookieSnapshotStore.persistPassportQrCookieSnapshot(args),
    })
  }

  hasLocalLoginCookies(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasLocalLoginCookies(config)
  }

  hasCookieCloudSource(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasCookieCloudSource(config)
  }

  hasLocalPassportCookie(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasLocalPassportCookie(config)
  }

  hasPassportRecoveryMaterial(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasPassportRecoveryMaterial(config)
  }

  hasConfiguredCookieSource(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasConfiguredCookieSource(config)
  }

  clearCookieCloudCache(): void {
    this.cookieCloudCache.clear()
  }

  async startPassportQrLogin(): Promise<PassportQrLoginPublicStatus> {
    return await this.passportQrLogin.start()
  }

  getPassportQrLoginStatus(): PassportQrLoginPublicStatus | null {
    return this.passportQrLogin.getStatus()
  }

  async pollPassportQrLogin(): Promise<PassportQrLoginPublicStatus> {
    return await this.passportQrLogin.poll()
  }

  cancelPassportQrLogin(): PassportQrLoginPublicStatus | null {
    return this.passportQrLogin.cancel()
  }

  async retryPassportQrLoginYuba(): Promise<PassportQrLoginPublicStatus> {
    return await this.passportQrLogin.retryYuba()
  }

  resolveCookieForUrlFromConfig(targetUrl: string, config: DockerConfig | null | undefined): string {
    return resolveCookieForUrlFromConfig(targetUrl, config)
  }

  resolveCookieForUrl(targetUrl: string): string {
    return this.resolveCookieForUrlFromConfig(targetUrl, this.deps.getConfig())
  }

  async getEffectiveCookies(forceRefresh = false): Promise<EffectiveCookiePreview> {
    return await this.effectiveCookieResolver.getEffectiveCookies(forceRefresh)
  }

  async persistEffectiveCookies(forceRefresh = false, options: {
    reloadJobs?: boolean
  } = {}): Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }> {
    const material = await this.effectiveCookieResolver.resolveMaterial(forceRefresh)
    return this.cookieSnapshotStore.persistEffectiveCookies(material, options)
  }

  async recoverCredentialSnapshot(options: {
    validateMainCookie: CookieSnapshotValidator
    log: CookieRecoveryLogger
    recoverYubaCookie?: boolean
  }): Promise<CredentialSnapshotRecoveryResult> {
    return await recoverCredentialSnapshotWithDeps({
      ...options,
      hasCookieCloudSource: () => this.hasCookieCloudSource(),
      persistEffectiveCookies: async forceRefresh => await this.persistEffectiveCookies(forceRefresh),
      loadCookieCloudSnapshot: async forceRefresh => await this.loadCookieCloudSnapshot(forceRefresh),
      getCurrentMainCookie: () => getLocalCookieForUrl(MAIN_DOUYU_URL, this.deps.getConfig()),
      getCurrentYubaCookie: () => getLocalCookieForUrl(YUBA_DOUYU_URL, this.deps.getConfig()),
      getManualPassportCookie: () => this.getPassportCookie(),
      persistManualCookieSnapshot: (mainCookie, yubaCookie) => this.cookieSnapshotStore.persistLocalCookieSnapshot(mainCookie, yubaCookie),
    })
  }

  async inspectCookieSource(): Promise<CookieDiagnostics> {
    const currentConfig = this.deps.getConfig()
    if (this.hasLocalLoginCookies(currentConfig)) {
      const mainCookie = getLocalCookieForUrl(MAIN_DOUYU_URL, currentConfig)
      const yubaCookie = getLocalCookieForUrl(YUBA_DOUYU_URL, currentConfig)
      return createCookieDiagnostics({
        source: this.hasCookieCloudSource(currentConfig) ? 'cookieCloud' : 'local',
        cookies: {
          passportCookie: this.getPassportCookie(),
          mainCookie,
          yubaCookie,
        },
        snapshot: {
          cookieCount: Object.keys({
            ...parseCookieRecord(mainCookie),
            ...parseCookieRecord(yubaCookie),
          }).length,
          domains: ['local'],
        },
      })
    }

    if (this.hasCookieCloudSource(currentConfig)) {
      throw new Error('CookieCloud 已启用，但本地登录快照为空，请先同步 CookieCloud')
    }

    throw new Error('请先配置 cookie')
  }

  private async loadCookieCloudSnapshot(forceRefresh = false): Promise<CookieCloudSnapshot> {
    return await this.cookieCloudCache.load(forceRefresh)
  }

  private getPassportCookie(): string {
    return this.deps.getConfig()?.loginCookies.passport.trim() || ''
  }
}
