import { parseCookieRecord } from '../core/api'
import { buildCookieHeaderForUrl, getCookieCloudPassportCookie, isCookieCloudReady } from '../core/cookie-cloud'
import type { DockerConfig, EffectiveCookiePreview } from '../core/types'
import type { CookieCloudSnapshot } from './runtime-cookie-cloud-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'

const COMPLETE_MAIN_COOKIE_KEYS = ['acf_uid', 'dy_did', 'acf_auth', 'acf_stk', 'acf_ltkid', 'acf_biz', 'acf_ct']
const COMPLETE_YUBA_COOKIE_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t']

export interface EffectiveCookieMaterial {
  effective: EffectiveCookiePreview
  passportCookie?: string
}

interface EffectiveCookieResolverDeps {
  getConfig: () => DockerConfig | null
  loadCookieCloudSnapshot: (forceRefresh?: boolean) => Promise<CookieCloudSnapshot>
}

export function hasLocalLoginCookies(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.loginCookies.main.trim()
    || config?.loginCookies.yuba.trim(),
  )
}

export function hasCookieCloudSource(config: DockerConfig | null | undefined): boolean {
  return isCookieCloudReady(config?.cookieCloud)
}

export function hasLocalPassportCookie(config: DockerConfig | null | undefined): boolean {
  return Boolean(config?.loginCookies.passport.trim())
}

export function hasPassportRecoveryMaterial(config: DockerConfig | null | undefined): boolean {
  return hasCookieCloudSource(config) || hasLocalPassportCookie(config)
}

export function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return hasLocalLoginCookies(config) || hasCookieCloudSource(config)
}

export function getLocalCookieForUrl(targetUrl: string, config: DockerConfig | null | undefined): string {
  const hostname = new URL(targetUrl).hostname
  const mainCookie = config?.loginCookies.main.trim() || ''
  const yubaCookie = config?.loginCookies.yuba.trim() || ''

  if (hostname === 'yuba.douyu.com') {
    return yubaCookie || mainCookie
  }

  return mainCookie
}

export function resolveCookieForUrlFromConfig(targetUrl: string, config: DockerConfig | null | undefined): string {
  const localCookie = getLocalCookieForUrl(targetUrl, config)

  if (localCookie) {
    return localCookie
  }

  if (hasCookieCloudSource(config)) {
    throw new Error(`CookieCloud 已启用，但 ${new URL(targetUrl).hostname} 的本地登录快照为空，请先同步 CookieCloud`)
  }

  throw new Error('请先配置 cookie')
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

export class DockerEffectiveCookieResolver {
  constructor(private readonly deps: EffectiveCookieResolverDeps) {}

  async getEffectiveCookies(forceRefresh = false): Promise<EffectiveCookiePreview> {
    return (await this.resolveMaterial(forceRefresh)).effective
  }

  async resolveMaterial(forceRefresh = false): Promise<EffectiveCookieMaterial> {
    const currentConfig = this.deps.getConfig()
    let mainCookie = getLocalCookieForUrl(MAIN_DOUYU_URL, currentConfig)
    let yubaCookie = getLocalCookieForUrl(YUBA_DOUYU_URL, currentConfig)
    let source: EffectiveCookiePreview['source'] = hasLocalLoginCookies(currentConfig) ? 'local' : 'none'
    let passportLtp0Present: boolean | undefined
    let passportCookie: string | undefined

    if (hasCookieCloudSource(currentConfig)) {
      const snapshot = await this.deps.loadCookieCloudSnapshot(forceRefresh)
      const cloudMainCookie = buildCookieHeaderForUrl(snapshot.cookies, MAIN_DOUYU_URL)
      const cloudYubaCookie = buildCookieHeaderForUrl(snapshot.cookies, YUBA_DOUYU_URL)
      const cloudPassportCookie = getCookieCloudPassportCookie(snapshot.cookies).trim()
      passportLtp0Present = Boolean(parseCookieRecord(cloudPassportCookie).LTP0)
      if (passportLtp0Present) {
        passportCookie = cloudPassportCookie
      }

      if (cloudMainCookie || cloudYubaCookie) {
        if (shouldUseSourceCookie(cloudMainCookie, mainCookie, COMPLETE_MAIN_COOKIE_KEYS)) {
          mainCookie = cloudMainCookie
        }
        if (shouldUseSourceCookie(cloudYubaCookie, yubaCookie, COMPLETE_YUBA_COOKIE_KEYS)) {
          yubaCookie = cloudYubaCookie
        }
        yubaCookie = yubaCookie || mainCookie
        source = hasLocalLoginCookies(currentConfig) ? 'hybrid' : 'cookieCloud'
      }
    }

    if (!mainCookie && !yubaCookie) {
      throw new Error('请先配置 cookie')
    }

    const resolvedYubaCookie = yubaCookie || mainCookie
    const latestConfig = this.deps.getConfig()
    const localPassportCookie = latestConfig?.loginCookies.passport.trim() || ''
    const persistedLocally = latestConfig?.loginCookies.main.trim() === mainCookie
      && latestConfig?.loginCookies.yuba.trim() === resolvedYubaCookie
      && (!passportCookie || localPassportCookie === passportCookie)

    return {
      effective: {
        source,
        mainCookie,
        yubaCookie: resolvedYubaCookie,
        cookieCloudEnabled: hasCookieCloudSource(latestConfig),
        persistedLocally,
        passportLtp0Present,
      },
      passportCookie,
    }
  }
}
