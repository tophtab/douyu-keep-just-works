import { isCookieCloudReady } from '../core/cookie-cloud'
import type { CookieCloudConfig, DockerConfig, DockerCookieSource, ManualCookieConfig, ManualPassportConfig } from '../core/types'

export function hasManualCookie(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.manualCookies?.main?.trim()
    || config?.manualCookies?.yuba?.trim()
    || config?.cookie?.trim(),
  )
}

export function hasCookieCloudSource(config: DockerConfig | null | undefined): boolean {
  return isCookieCloudReady(config?.cookieCloud)
}

export function hasManualPassport(config: DockerConfig | null | undefined): boolean {
  return Boolean(config?.manualPassport?.cookie?.trim())
}

export function hasPassportRecoveryMaterial(config: DockerConfig | null | undefined): boolean {
  return hasCookieCloudSource(config) || hasManualPassport(config)
}

export function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return hasManualCookie(config) || hasCookieCloudSource(config)
}

export function summarizeCookieSource(config: DockerConfig | null | undefined): DockerCookieSource {
  const manual = hasManualCookie(config)
  const cookieCloud = hasCookieCloudSource(config)

  if (manual && cookieCloud) {
    return 'hybrid'
  }
  if (cookieCloud) {
    return 'cookieCloud'
  }
  if (manual) {
    return 'manual'
  }
  return 'none'
}

export function maskCookie(cookie: string): string {
  if (cookie.length <= 20) {
    return '***'
  }
  return `${cookie.substring(0, 10)}...${cookie.substring(cookie.length - 10)}`
}

export function maskCookieCloud(config: CookieCloudConfig | undefined): CookieCloudConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    ...config,
    password: config.password ? maskCookie(config.password) : '',
  }
}

export function maskManualCookies(config: ManualCookieConfig | undefined): ManualCookieConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    main: config.main ? maskCookie(config.main) : '',
    yuba: config.yuba ? maskCookie(config.yuba) : '',
  }
}

export function maskManualPassport(config: ManualPassportConfig | undefined): ManualPassportConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    cookie: config.cookie ? maskCookie(config.cookie) : '',
  }
}
