import { parseCookieRecord } from '../core/api'
import { createCookieDiagnostics } from '../core/cookie-diagnostics'
import type { CookieDiagnostics, DockerConfig, PassportQrLoginPublicStatus } from '../core/types'
import { DockerCookieSnapshotStore } from './runtime-cookie-snapshot-store'
import { recoverCredentialSnapshot as recoverCredentialSnapshotWithDeps } from './runtime-cookie-recovery'
import type { CookieRecoveryLogger, CookieSnapshotValidator, CredentialSnapshotRecoveryResult } from './runtime-cookie-recovery'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { getLocalCookieForUrl, hasConfiguredCookieSource, hasLocalLoginCookies, hasLocalPassportCookie, resolveCookieForUrlFromConfig } from './runtime-effective-cookies'
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
  private readonly cookieSnapshotStore: DockerCookieSnapshotStore
  private readonly passportQrLogin: DockerPassportQrLoginService

  constructor(private readonly deps: DockerCookieSourceManagerDeps) {
    this.cookieSnapshotStore = new DockerCookieSnapshotStore({
      getConfig: this.deps.getConfig,
      setConfig: this.deps.setConfig,
      getConfigPath: this.deps.getConfigPath,
      applyConfig: this.deps.applyConfig,
      clearFansListCache: this.deps.clearFansListCache,
      invalidateStatusCaches: this.deps.invalidateStatusCaches,
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

  hasLocalPassportCookie(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasLocalPassportCookie(config)
  }

  hasConfiguredCookieSource(config: DockerConfig | null | undefined = this.deps.getConfig()): boolean {
    return hasConfiguredCookieSource(config)
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

  async recoverCredentialSnapshot(options: {
    validateMainCookie: CookieSnapshotValidator
    log: CookieRecoveryLogger
    recoverYubaCookie?: boolean
  }): Promise<CredentialSnapshotRecoveryResult> {
    return await recoverCredentialSnapshotWithDeps({
      ...options,
      getCurrentMainCookie: () => getLocalCookieForUrl(MAIN_DOUYU_URL, this.deps.getConfig()),
      getCurrentYubaCookie: () => getLocalCookieForUrl(YUBA_DOUYU_URL, this.deps.getConfig()),
      getManualPassportCookie: () => this.getPassportCookie(),
      persistManualCookieSnapshot: (mainCookie, yubaCookie) => this.cookieSnapshotStore.persistLocalCookieSnapshot(mainCookie, yubaCookie),
    })
  }

  async inspectCookieSource(): Promise<CookieDiagnostics> {
    const currentConfig = this.deps.getConfig()
    if (!this.hasLocalLoginCookies(currentConfig)) {
      throw new Error('请先配置 cookie')
    }

    const mainCookie = getLocalCookieForUrl(MAIN_DOUYU_URL, currentConfig)
    const yubaCookie = getLocalCookieForUrl(YUBA_DOUYU_URL, currentConfig)
    return createCookieDiagnostics({
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
      },
    })
  }

  private getPassportCookie(): string {
    return this.deps.getConfig()?.loginCookies.passport.trim() || ''
  }
}
