import axios from 'axios'
import { DOUYU_USER_AGENT, parseCookieRecord } from './api'

const SAFE_AUTH_URL = 'https://passport.douyu.com/lapi/passport/iframe/safeAuth'
const SAFE_AUTH_RETURNED_COOKIE_KEYS = [
  'acf_uid',
  'acf_auth',
  'acf_stk',
  'acf_ltkid',
  'acf_username',
  'acf_biz',
  'acf_ct',
  'dy_auth',
]
const SAFE_AUTH_REQUIRED_COOKIE_KEYS = ['acf_uid', 'acf_auth', 'acf_stk', 'acf_ltkid']

export interface DouyuPassportSafeAuthResult {
  refreshedCookie: string
  returnedKeys: string[]
}

function readSetCookieHeaders(headers: unknown): string[] {
  if (!headers || typeof headers !== 'object') {
    return []
  }

  const value = (headers as Record<string, unknown>)['set-cookie'] ?? (headers as Record<string, unknown>)['Set-Cookie']
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return typeof value === 'string' ? [value] : []
}

function parseSetCookiePair(header: string): [string, string] | null {
  const firstPart = header.split(';')[0]?.trim() || ''
  const separatorIndex = firstPart.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  const name = firstPart.slice(0, separatorIndex).trim()
  const value = firstPart.slice(separatorIndex + 1)
  return name ? [name, value] : null
}

export function mergeMainCookieWithSetCookieHeaders(currentCookie: string, setCookieHeaders: string[]): DouyuPassportSafeAuthResult {
  const nextCookies = parseCookieRecord(currentCookie)
  const returnedKeys: string[] = []

  for (const header of setCookieHeaders) {
    const pair = parseSetCookiePair(header)
    if (!pair) {
      continue
    }

    const [name, value] = pair
    if (!SAFE_AUTH_RETURNED_COOKIE_KEYS.includes(name)) {
      continue
    }

    nextCookies[name] = value
    if (!returnedKeys.includes(name)) {
      returnedKeys.push(name)
    }
  }

  const missingKeys = SAFE_AUTH_REQUIRED_COOKIE_KEYS.filter(name => !nextCookies[name])
  if (!returnedKeys.length || missingKeys.length > 0) {
    throw new Error(`safeAuth 未返回可用主站登录字段${missingKeys.length ? `，缺少 ${missingKeys.join(', ')}` : ''}`)
  }

  return {
    refreshedCookie: Object.entries(nextCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; '),
    returnedKeys: returnedKeys.sort((a, b) => a.localeCompare(b)),
  }
}

export async function refreshDouyuMainCookiesWithSafeAuth(args: {
  mainCookie: string
  dyDid: string
  ltp0: string
}): Promise<DouyuPassportSafeAuthResult> {
  if (!args.dyDid) {
    throw new Error('safeAuth 缺少 dy_did')
  }
  if (!args.ltp0) {
    throw new Error('safeAuth 缺少 LTP0')
  }

  const timestamp = String(Date.now())
  const response = await axios.get(SAFE_AUTH_URL, {
    headers: {
      'Cookie': `dy_did=${args.dyDid}; LTP0=${args.ltp0}`,
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': 'https://www.douyu.com/',
      'Origin': 'https://www.douyu.com',
    },
    params: {
      client_id: '1',
      t: timestamp,
      _: timestamp,
      callback: 'axiosJsonpCallback',
    },
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 400,
  })

  return mergeMainCookieWithSetCookieHeaders(args.mainCookie, readSetCookieHeaders(response.headers))
}
