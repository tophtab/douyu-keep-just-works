import { getCookieValue } from './api'
import type { CookieDiagnostics, LoginCookieValues } from './types'

const MAIN_REQUIRED_KEYS = ['acf_uid', 'dy_did', 'acf_auth', 'acf_stk']
const YUBA_COOKIE_REQUIRED_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t']
const YUBA_DY_TOKEN_REQUIRED_KEYS = ['acf_uid', 'acf_biz', 'acf_stk', 'acf_ct', 'acf_ltkid']

/**
 * 只读的本地登录态诊断。不发网络请求，也不保存任何原始 cookie 值。
 */
export function createCookieDiagnostics(options: {
  cookies: LoginCookieValues
  snapshot: {
    cookieCount: number
  }
}): CookieDiagnostics {
  const { cookies, snapshot } = options
  const { passportCookie, mainCookie, yubaCookie } = cookies
  const missingMainKeys = MAIN_REQUIRED_KEYS.filter(name => !getCookieValue(mainCookie, name))
  const missingYubaCookieKeys = YUBA_COOKIE_REQUIRED_KEYS.filter(name => !getCookieValue(yubaCookie, name))
  const missingYubaDyTokenKeys = YUBA_DY_TOKEN_REQUIRED_KEYS.filter(name => !getCookieValue(mainCookie, name))

  return {
    passport: {
      ltp0Present: Boolean(getCookieValue(passportCookie, 'LTP0')),
    },
    main: {
      ready: missingMainKeys.length === 0,
      missingKeys: missingMainKeys,
    },
    yuba: {
      dyTokenReady: missingYubaDyTokenKeys.length === 0,
      cookieReady: missingYubaCookieKeys.length === 0,
      missingDyTokenKeys: missingYubaDyTokenKeys,
      missingCookieKeys: missingYubaCookieKeys,
    },
    snapshot,
  }
}
