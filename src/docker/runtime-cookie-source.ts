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
import { DockerEffectiveCookieResolver, getManualCookieForUrl, hasConfiguredCookieSource, hasCookieCloudSource, hasManualCookie, hasManualPassport, hasPassportRecoveryMaterial, resolveCookieForUrlFromConfig } from './runtime-effective-cookies'
import { DockerPassportQrLoginService } from './runtime-passport-qr-login'

export class DockerCookieSourceManager {
  private readonly cookieCloudCache: DockerCookieCloudCache
  private readonly cookieSnapshotStore: DockerCookieSnapshotStore
  private readonly effectiveCookieResolver: DockerEffectiveCookieResolver
  private readonly passportQrLogin: DockerPassportQrLoginService

  constructor(
    private readonly getConfig: () => DockerConfig | null,
    private readonly setConfig: (config: DockerConfig) => void,
    private readonly getConfigPath: () => string,
    private readonly applyConfig: (config: DockerConfig, reason: 'cookie_saved') => void,
    private readonly clearFansListCache: () => void,
    private readonly invalidateStatusCaches: (scope: StatusCacheScope) => void,
  ) {
    this.cookieCloudCache = new DockerCookieCloudCache(this.getConfig)
    this.cookieSnapshotStore = new DockerCookieSnapshotStore({
      getConfig: this.getConfig,
      setConfig: this.setConfig,
      getConfigPath: this.getConfigPath,
      applyConfig: this.applyConfig,
      clearFansListCache: this.clearFansListCache,
      invalidateStatusCaches: this.invalidateStatusCaches,
    })
    this.effectiveCookieResolver = new DockerEffectiveCookieResolver({
      getConfig: this.getConfig,
      loadCookieCloudSnapshot: async forceRefresh => await this.loadCookieCloudSnapshot(forceRefresh),
    })
    this.passportQrLogin = new DockerPassportQrLoginService({
      getCurrentMainCookie: () => getManualCookieForUrl(MAIN_DOUYU_URL, this.getConfig()),
      getCurrentYubaCookie: () => getManualCookieForUrl(YUBA_DOUYU_URL, this.getConfig()),
      getManualPassportCookie: () => this.getManualPassportCookie(),
      persistCookieSnapshot: args => this.cookieSnapshotStore.persistPassportQrCookieSnapshot(args),
    })
  }

  hasManualCookie(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return hasManualCookie(config)
  }

  hasCookieCloudSource(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return hasCookieCloudSource(config)
  }

  hasManualPassport(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return hasManualPassport(config)
  }

  hasPassportRecoveryMaterial(config: DockerConfig | null | undefined = this.getConfig()): boolean {
    return hasPassportRecoveryMaterial(config)
  }

  hasConfiguredCookieSource(config: DockerConfig | null | undefined = this.getConfig()): boolean {
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
    return this.resolveCookieForUrlFromConfig(targetUrl, this.getConfig())
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
      getCurrentMainCookie: () => getManualCookieForUrl(MAIN_DOUYU_URL, this.getConfig()),
      getCurrentYubaCookie: () => getManualCookieForUrl(YUBA_DOUYU_URL, this.getConfig()),
      getManualPassportCookie: () => this.getManualPassportCookie(),
      persistManualCookieSnapshot: (mainCookie, yubaCookie) => this.cookieSnapshotStore.persistManualCookieSnapshot(mainCookie, yubaCookie),
    })
  }

  async inspectCookieSource(): Promise<CookieDiagnostics> {
    const currentConfig = this.getConfig()
    if (this.hasManualCookie(currentConfig)) {
      const mainCookie = getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
      const yubaCookie = getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
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

  private async loadCookieCloudSnapshot(forceRefresh = false): Promise<CookieCloudSnapshot> {
    return await this.cookieCloudCache.load(forceRefresh)
  }

  private getManualPassportCookie(): string {
    return this.getConfig()?.manualPassport?.cookie?.trim() || ''
  }
}
