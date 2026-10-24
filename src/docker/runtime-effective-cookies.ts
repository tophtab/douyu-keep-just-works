import type { DockerConfig } from '../core/types'

export function hasLocalLoginCookies(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.loginCookies.main.trim()
    || config?.loginCookies.yuba.trim(),
  )
}

export function hasLocalPassportCookie(config: DockerConfig | null | undefined): boolean {
  return Boolean(config?.loginCookies.passport.trim())
}

export function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return hasLocalLoginCookies(config)
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

  throw new Error('请先配置 cookie')
}
