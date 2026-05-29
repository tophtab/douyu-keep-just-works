import { parseCookieRecord } from '../core/api'
import { buildCookieHeaderForUrl, createCookieDiagnostics, fetchCookieCloudSnapshot, getCookieCloudPassportLtp0, isCookieCloudReady } from '../core/cookie-cloud'
import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, EffectiveCookiePreview } from '../core/types'
import { buildConfigWithPartialUpdate, configsEqual, saveConfigToDisk } from './config-store'
import { recoverCredentialSnapshot as recoverCredentialSnapshotWithDeps } from './runtime-cookie-recovery'
import type { CookieRecoveryLogger, CookieSnapshotValidator, CredentialSnapshotRecoveryResult } from './runtime-cookie-recovery'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'

const COOKIE_CLOUD_CACHE_TTL_MS = 60 * 1000

interface CookieCloudCacheEntry {
  key: string
  fetchedAt: number
  snapshot: Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>
}

export class DockerCookieSourceManager {
  private cookieCloudCache: CookieCloudCacheEntry | null = null

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
    return Boolean(config?.manualPassport?.ltp0?.trim())
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
    const currentConfig = this.getConfig()
    let mainCookie = this.getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
    let yubaCookie = this.getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
    let source: EffectiveCookiePreview['source'] = this.hasManualCookie(currentConfig) ? 'manual' : 'none'
    let passportLtp0Present: boolean | undefined

    if (this.hasCookieCloudSource(currentConfig)) {
      const snapshot = await this.loadCookieCloudSnapshot(forceRefresh)
      const cloudMainCookie = buildCookieHeaderForUrl(snapshot.cookies, MAIN_DOUYU_URL)
      const cloudYubaCookie = buildCookieHeaderForUrl(snapshot.cookies, YUBA_DOUYU_URL)
      passportLtp0Present = Boolean(getCookieCloudPassportLtp0(snapshot.cookies))

      if (cloudMainCookie || cloudYubaCookie) {
        mainCookie = cloudMainCookie || mainCookie
        yubaCookie = cloudYubaCookie || yubaCookie || mainCookie
        source = this.hasManualCookie(currentConfig) ? 'hybrid' : 'cookieCloud'
      }
    }

    if (!mainCookie && !yubaCookie) {
      throw new Error('请先配置 cookie')
    }

    const resolvedYubaCookie = yubaCookie || mainCookie
    const latestConfig = this.getConfig()
    const persistedLocally = latestConfig?.manualCookies?.main?.trim() === mainCookie
      && latestConfig?.manualCookies?.yuba?.trim() === resolvedYubaCookie

    return {
      source,
      mainCookie,
      yubaCookie: resolvedYubaCookie,
      cookieCloudActive: this.hasCookieCloudSource(latestConfig),
      persistedLocally,
      passportLtp0Present,
    }
  }

  async persistEffectiveCookies(forceRefresh = false, options: {
    reloadJobs?: boolean
  } = {}): Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }> {
    const effective = await this.getEffectiveCookies(forceRefresh)
    const nextConfig = buildConfigWithPartialUpdate(this.getConfig(), {
      manualCookies: {
        main: effective.mainCookie.trim(),
        yuba: effective.yubaCookie.trim(),
      },
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
      getManualPassportLtp0: () => this.getManualPassportLtp0(),
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
        passportLtp0Present: this.hasManualPassport(currentConfig) ? true : undefined,
      })
    }

    if (this.hasCookieCloudSource(currentConfig)) {
      throw new Error('CookieCloud 已启用，但本地登录快照为空，请先同步 CookieCloud')
    }

    throw new Error('请先配置 cookie')
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

  private getManualPassportLtp0(): string {
    return this.getConfig()?.manualPassport?.ltp0?.trim() || ''
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
