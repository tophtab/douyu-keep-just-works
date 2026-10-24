import * as fs from 'node:fs'
import { parseCookieRecord } from '../core/api'
import { createCookieDiagnostics } from '../core/cookie-cloud'
import type { CookieStatusSummary, DockerConfig } from '../core/types'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { getLocalCookieForUrl, hasCookieCloudSource, hasLocalLoginCookies } from './runtime-effective-cookies'

/**
 * 汇总推送/WebUI 用的登录态摘要。
 * 只读本地配置，不发网络请求，因此可以随时调用（含日报推送前）。
 */
export function buildCookieStatus(config: DockerConfig | null, configPath: string): CookieStatusSummary {
  const empty: CookieStatusSummary = {
    source: 'local',
    ltp0Present: false,
    mainReady: false,
    mainMissingKeys: [],
    yubaReady: false,
    yubaMissingKeys: [],
    cookieCount: 0,
  }

  if (!config || !hasLocalLoginCookies(config)) {
    return { ...empty, error: '本地登录快照为空，请扫码登录' }
  }

  try {
    const mainCookie = getLocalCookieForUrl(MAIN_DOUYU_URL, config)
    const yubaCookie = getLocalCookieForUrl(YUBA_DOUYU_URL, config)
    const diagnostics = createCookieDiagnostics({
      source: hasCookieCloudSource(config) ? 'cookieCloud' : 'local',
      cookies: {
        passportCookie: config.loginCookies.passport.trim(),
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

    let updatedAt: string | undefined
    try {
      updatedAt = fs.statSync(configPath).mtime.toISOString()
    } catch {
      updatedAt = undefined
    }

    const yubaMissingKeys = Array.from(new Set([
      ...diagnostics.yuba.missingDyTokenKeys,
      ...diagnostics.yuba.missingCookieKeys,
    ]))

    return {
      source: diagnostics.source,
      ltp0Present: diagnostics.passport.ltp0Present,
      mainReady: diagnostics.main.ready,
      mainMissingKeys: diagnostics.main.missingKeys,
      // 鱼吧签到没启用时，鱼吧缺字段不算故障，这里只如实报告
      yubaReady: yubaMissingKeys.length === 0,
      yubaMissingKeys,
      cookieCount: diagnostics.snapshot.cookieCount,
      updatedAt,
    }
  } catch (error: unknown) {
    return { ...empty, error: error instanceof Error ? error.message : String(error) }
  }
}
