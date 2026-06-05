import axios from 'axios'
import { DOUYU_USER_AGENT, getCookieValue, parseCookieRecord } from './api'

const SAFE_AUTH_URL = 'https://passport.douyu.com/lapi/passport/iframe/safeAuth'
const PASSPORT_QR_GENERATE_URL = 'https://passport.douyu.com/scan/generateCode'
const PASSPORT_QR_AUTH_URL = 'https://passport.douyu.com/japi/scan/auth'
const PASSPORT_LOGIN_REFERER = 'https://passport.douyu.com/index/login?type=login&client_id=1'
const PASSPORT_MAIN_LOGIN_ORIGIN = 'https://www.douyu.com'
const PASSPORT_MAIN_LOGIN_PATH = '/api/passport/login'
const PASSPORT_MAIN_LOGIN_CALLBACK = 'appClient_json_callback'
const YUBA_MY_GROUPS_URL = 'https://yuba.douyu.com/mygroups'
const YUBA_AUTH_LOGIN_URL = 'https://yuba.douyu.com/ybapi/authlogin'
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
const SAFE_AUTH_REQUIRED_COOKIE_KEYS = ['acf_uid', 'acf_auth', 'acf_stk', 'acf_ltkid', 'acf_biz', 'acf_ct']
const PASSPORT_COOKIE_KEYS = ['dy_accounts_main', 'LTP0', 'dy_did', 'acf_did', 'game_did']
const YUBA_RETURNED_COOKIE_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t', 'acf_yb_new_uid', 'dy_did']
const YUBA_REQUIRED_COOKIE_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t']

export type DouyuPassportQrStatus = 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'cancelled' | 'failed'

export interface DouyuPassportSafeAuthResult {
  refreshedCookie: string
  returnedKeys: string[]
}

export interface DouyuPassportQrChallenge {
  code: string
  qrUrl: string
  expiresIn: number
  expiresAt: number
}

export interface DouyuPassportQrPollResult {
  status: DouyuPassportQrStatus
  message: string
  passportCookie?: string
  loginUrl?: string
}

export interface DouyuYubaSsoResult {
  yubaCookie: string
  returnedKeys: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

export function readSetCookieHeaders(headers: unknown): string[] {
  if (!headers || typeof headers !== 'object') {
    return []
  }

  const value = (headers as Record<string, unknown>)['set-cookie'] ?? (headers as Record<string, unknown>)['Set-Cookie']
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return typeof value === 'string' ? [value] : []
}

export function parseSetCookiePair(header: string): [string, string] | null {
  const firstPart = header.split(';')[0]?.trim() || ''
  const separatorIndex = firstPart.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  const name = firstPart.slice(0, separatorIndex).trim()
  const value = firstPart.slice(separatorIndex + 1)
  return name ? [name, value] : null
}

function buildCookieHeader(cookieRecord: Record<string, string>): string {
  return Object.entries(cookieRecord)
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function mergeCookieWithSetCookieHeaders(args: {
  currentCookie: string
  setCookieHeaders: string[]
  allowedKeys: string[]
  requiredKeys: string[]
  missingMessage: string
}): DouyuPassportSafeAuthResult {
  const nextCookies = parseCookieRecord(args.currentCookie)
  const returnedKeys: string[] = []

  for (const header of args.setCookieHeaders) {
    const pair = parseSetCookiePair(header)
    if (!pair) {
      continue
    }

    const [name, value] = pair
    if (!args.allowedKeys.includes(name)) {
      continue
    }

    nextCookies[name] = value
    if (!returnedKeys.includes(name)) {
      returnedKeys.push(name)
    }
  }

  const missingKeys = args.requiredKeys.filter(name => !nextCookies[name])
  if (!returnedKeys.length || missingKeys.length > 0) {
    throw new Error(`${args.missingMessage}${missingKeys.length ? `，缺少 ${missingKeys.join(', ')}` : ''}`)
  }

  return {
    refreshedCookie: buildCookieHeader(nextCookies),
    returnedKeys: returnedKeys.sort((a, b) => a.localeCompare(b)),
  }
}

export function mergeMainCookieWithSetCookieHeaders(
  currentCookie: string,
  setCookieHeaders: string[],
  missingMessage = 'safeAuth 未返回可用主站登录字段',
): DouyuPassportSafeAuthResult {
  return mergeCookieWithSetCookieHeaders({
    currentCookie,
    setCookieHeaders,
    allowedKeys: SAFE_AUTH_RETURNED_COOKIE_KEYS,
    requiredKeys: SAFE_AUTH_REQUIRED_COOKIE_KEYS,
    missingMessage,
  })
}

export function mergePassportCookieWithSetCookieHeaders(currentCookie: string, setCookieHeaders: string[]): DouyuPassportSafeAuthResult {
  return mergeCookieWithSetCookieHeaders({
    currentCookie,
    setCookieHeaders,
    allowedKeys: PASSPORT_COOKIE_KEYS,
    requiredKeys: ['LTP0'],
    missingMessage: '扫码登录 passport 未返回可用字段',
  })
}

export function mergeYubaCookieWithSetCookieHeaders(currentCookie: string, setCookieHeaders: string[]): DouyuYubaSsoResult {
  const result = mergeCookieWithSetCookieHeaders({
    currentCookie,
    setCookieHeaders,
    allowedKeys: YUBA_RETURNED_COOKIE_KEYS,
    requiredKeys: YUBA_REQUIRED_COOKIE_KEYS,
    missingMessage: '鱼吧 SSO 未返回可用字段',
  })
  return {
    yubaCookie: result.refreshedCookie,
    returnedKeys: result.returnedKeys,
  }
}

function getJsonpBodyObject(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data
  }

  const text = data.trim()
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return data
  }

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1))
  } catch {
    return data
  }
}

function normalizePassportMainLoginUrl(rawLoginUrl: string): string {
  let loginUrl: URL
  try {
    loginUrl = new URL(rawLoginUrl)
  } catch {
    throw new Error('扫码登录主站地址无效')
  }

  if (loginUrl.origin !== PASSPORT_MAIN_LOGIN_ORIGIN || loginUrl.pathname !== PASSPORT_MAIN_LOGIN_PATH) {
    throw new Error('扫码登录主站地址无效')
  }

  if (!loginUrl.searchParams.has('callback')) {
    loginUrl.searchParams.set('callback', PASSPORT_MAIN_LOGIN_CALLBACK)
  }
  if (!loginUrl.searchParams.has('_')) {
    loginUrl.searchParams.set('_', String(Date.now()))
  }

  return loginUrl.toString()
}

function readPassportQrStatus(errorCode: number | undefined): DouyuPassportQrStatus {
  if (errorCode === 0) {
    return 'confirmed'
  }
  if (errorCode === 1) {
    return 'scanned'
  }
  if (errorCode === -2) {
    return 'waiting'
  }
  if (errorCode === -3 || errorCode === 2) {
    return 'expired'
  }
  if (errorCode === -4) {
    return 'cancelled'
  }
  return 'failed'
}

export async function generateDouyuPassportQrChallenge(now = Date.now()): Promise<DouyuPassportQrChallenge> {
  const formData = new URLSearchParams()
  formData.set('client_id', '1')
  formData.set('isMultiAccount', '0')

  const { data } = await axios.post(PASSPORT_QR_GENERATE_URL, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': PASSPORT_LOGIN_REFERER,
    },
  })

  const body = isRecord(data) ? data : {}
  const errorCode = readNumber(body.error)
  const payload = isRecord(body.data) ? body.data : {}
  const code = readString(payload.code)
  const qrUrl = readString(payload.url)
  const expiresIn = readNumber(payload.expire) || 300
  if (errorCode !== 0 || !code || !qrUrl) {
    throw new Error('生成斗鱼扫码登录二维码失败')
  }

  return {
    code,
    qrUrl,
    expiresIn,
    expiresAt: now + expiresIn * 1000,
  }
}

export async function pollDouyuPassportQrAuth(code: string, currentPassportCookie = ''): Promise<DouyuPassportQrPollResult> {
  const normalizedCode = code.trim()
  if (!normalizedCode) {
    throw new Error('扫码登录缺少二维码编号')
  }

  const response = await axios.get(PASSPORT_QR_AUTH_URL, {
    headers: {
      'Cookie': currentPassportCookie,
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': PASSPORT_LOGIN_REFERER,
    },
    params: {
      time: String(Date.now()),
      code: normalizedCode,
    },
    validateStatus: status => status >= 200 && status < 500,
  })

  const body = isRecord(response.data) ? response.data : {}
  const errorCode = readNumber(body.error)
  const status = readPassportQrStatus(errorCode)
  const message = readString(body.msg) || readString(body.message) || status

  if (status !== 'confirmed') {
    return { status, message }
  }

  const payload = isRecord(body.data) ? body.data : {}
  const loginUrl = readString(payload.url)
  const passportCookie = mergePassportCookieWithSetCookieHeaders(
    currentPassportCookie,
    readSetCookieHeaders(response.headers),
  ).refreshedCookie

  if (!loginUrl) {
    throw new Error('扫码登录已确认，但斗鱼未返回主站登录地址')
  }

  return {
    status,
    message,
    passportCookie,
    loginUrl,
  }
}

export async function fetchDouyuMainCookiesFromLoginUrl(args: {
  loginUrl: string
  mainCookie?: string
  passportCookie?: string
}): Promise<DouyuPassportSafeAuthResult> {
  const loginUrl = normalizePassportMainLoginUrl(args.loginUrl.trim())

  const response = await axios.get(loginUrl, {
    headers: {
      'Cookie': [args.passportCookie, args.mainCookie].filter(Boolean).join('; '),
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': 'https://www.douyu.com/',
    },
    validateStatus: status => status >= 200 && status < 400,
  })

  const body = getJsonpBodyObject(response.data)
  if (isRecord(body)) {
    const errorCode = readNumber(body.error)
    if (errorCode !== undefined && errorCode !== 0) {
      throw new Error(`扫码登录主站失败: ${readString(body.msg) || readString(body.message) || errorCode}`)
    }
  }

  const dyDid = getCookieValue(args.passportCookie || '', 'dy_did')
  const baseMainCookie = args.mainCookie?.trim() || (dyDid ? `dy_did=${dyDid}` : '')
  return mergeMainCookieWithSetCookieHeaders(
    baseMainCookie,
    readSetCookieHeaders(response.headers),
    '扫码登录主站未返回可用登录字段',
  )
}

export async function fetchDouyuYubaCookiesWithPassport(args: {
  passportCookie: string
  mainCookie: string
  yubaCookie?: string
}): Promise<DouyuYubaSsoResult> {
  const passportCookie = args.passportCookie.trim()
  if (!getCookieValue(passportCookie, 'LTP0')) {
    throw new Error('鱼吧 SSO 缺少 passport LTP0')
  }

  const mergedCookie = [passportCookie, args.mainCookie, args.yubaCookie]
    .filter((item): item is string => Boolean(item?.trim()))
    .join('; ')

  const safeAuthResponse = await axios.get(SAFE_AUTH_URL, {
    headers: {
      'Cookie': mergedCookie,
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': YUBA_MY_GROUPS_URL,
      'Origin': 'https://yuba.douyu.com',
    },
    params: {
      client_id: '1',
      t: String(Date.now()),
      _: String(Date.now()),
      callback: 'axiosJsonpCallback',
    },
    validateStatus: status => status >= 200 && status < 400,
  })

  let bridgeMainCookie = args.mainCookie
  try {
    bridgeMainCookie = mergeMainCookieWithSetCookieHeaders(args.mainCookie, readSetCookieHeaders(safeAuthResponse.headers)).refreshedCookie
  } catch {
    bridgeMainCookie = args.mainCookie
  }

  const authResponse = await axios.get(YUBA_AUTH_LOGIN_URL, {
    headers: {
      'Cookie': [passportCookie, bridgeMainCookie, args.yubaCookie]
        .filter((item): item is string => Boolean(item?.trim()))
        .join('; '),
      'User-Agent': DOUYU_USER_AGENT,
      'Referer': YUBA_MY_GROUPS_URL,
    },
    validateStatus: status => status >= 200 && status < 400,
  })

  return mergeYubaCookieWithSetCookieHeaders(args.yubaCookie || '', readSetCookieHeaders(authResponse.headers))
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
    validateStatus: status => status >= 200 && status < 400,
  })

  return mergeMainCookieWithSetCookieHeaders(args.mainCookie, readSetCookieHeaders(response.headers))
}
