import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import axios from 'axios'
import { getCookieValue } from './api'
import type {
  CookieCloudConfig,
  CookieCloudCookie,
  CookieCloudCryptoType,
  CookieDiagnostics,
} from './types'

interface CookieCloudResponse {
  encrypted?: string
}

interface CookieCloudPayload {
  cookie_data?: Record<string, unknown>
  update_time?: unknown
}

export interface CookieCloudSnapshot {
  cookies: CookieCloudCookie[]
  cryptoType: CookieCloudCryptoType
  domains: string[]
  updateTime?: string
}

const COOKIE_CLOUD_MAIN_REQUIRED_KEYS = ['acf_uid', 'dy_did', 'acf_auth', 'acf_stk']
const COOKIE_CLOUD_YUBA_REQUIRED_KEYS = ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t']

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function normalizeNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeCookieCloudCryptoType(): CookieCloudCryptoType {
  return 'legacy'
}

function normalizeCookie(cookie: Record<string, unknown>): CookieCloudCookie | null {
  const name = normalizeString(cookie.name)
  const value = typeof cookie.value === 'string' ? cookie.value : String(cookie.value ?? '')
  const domain = normalizeString(cookie.domain)

  if (!name || !domain) {
    return null
  }

  return {
    name,
    value,
    domain,
    path: normalizeString(cookie.path) || '/',
    secure: normalizeBoolean(cookie.secure),
    httpOnly: normalizeBoolean(cookie.httpOnly),
    hostOnly: normalizeBoolean(cookie.hostOnly),
    sameSite: normalizeString(cookie.sameSite) || undefined,
    expirationDate: normalizeNumber(cookie.expirationDate),
  }
}

function flattenCookieData(cookieData: Record<string, unknown>): CookieCloudCookie[] {
  const cookies: CookieCloudCookie[] = []

  for (const items of Object.values(cookieData)) {
    if (!Array.isArray(items)) {
      continue
    }

    for (const item of items) {
      if (typeof item !== 'object' || item === null) {
        continue
      }

      const normalized = normalizeCookie(item as Record<string, unknown>)
      if (normalized) {
        cookies.push(normalized)
      }
    }
  }

  return cookies
}

function evpBytesToKey(passphrase: Uint8Array, salt: Uint8Array, keyLength: number, ivLength: number) {
  const blocks: Uint8Array[] = []
  let current: Uint8Array = Buffer.alloc(0)

  while (Buffer.concat(blocks.map(item => Buffer.from(item))).length < keyLength + ivLength) {
    const hash = crypto.createHash('md5')
    hash.update(current)
    hash.update(passphrase)
    hash.update(salt)
    current = hash.digest()
    blocks.push(current)
  }

  const derived = Buffer.concat(blocks.map(item => Buffer.from(item)))
  return {
    key: derived.subarray(0, keyLength),
    iv: derived.subarray(keyLength, keyLength + ivLength),
  }
}

function decryptLegacyCookieCloudPayload(uuid: string, password: string, encrypted: string): string {
  const raw = Buffer.from(encrypted, 'base64')
  if (raw.length < 16 || raw.subarray(0, 8).toString('utf8') !== 'Salted__') {
    throw new Error('CookieCloud legacy 密文格式无效')
  }

  const salt = raw.subarray(8, 16)
  const ciphertext = raw.subarray(16)
  const secret = Buffer.from(crypto.createHash('md5').update(`${uuid}-${password}`).digest('hex').slice(0, 16), 'utf8')
  const { key, iv } = evpBytesToKey(secret, salt, 32, 16)

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

function decryptCookieCloudPayload(uuid: string, password: string, encrypted: string): CookieCloudPayload {
  const decrypted = decryptLegacyCookieCloudPayload(uuid, password, encrypted)
  const payload = JSON.parse(decrypted) as CookieCloudPayload
  if (!payload || typeof payload !== 'object') {
    throw new Error('CookieCloud 解密结果格式无效')
  }
  return payload
}

function normalizeHostname(value: string): string {
  return value.trim().replace(/^\.+/, '').toLowerCase()
}

function isCookieExpired(cookie: CookieCloudCookie): boolean {
  return typeof cookie.expirationDate === 'number' && cookie.expirationDate > 0 && cookie.expirationDate <= (Date.now() / 1000)
}

function domainMatches(cookie: CookieCloudCookie, hostname: string): boolean {
  const cookieDomain = normalizeHostname(cookie.domain)
  if (!cookieDomain) {
    return false
  }

  if (cookie.hostOnly) {
    return hostname === cookieDomain
  }

  return hostname === cookieDomain || hostname.endsWith(`.${cookieDomain}`)
}

function pathMatches(cookiePath: string | undefined, requestPath: string): boolean {
  const normalizedCookiePath = cookiePath || '/'
  return requestPath.startsWith(normalizedCookiePath)
}

function compareCookieSpecificity(a: CookieCloudCookie, b: CookieCloudCookie, hostname: string): number {
  const aDomain = normalizeHostname(a.domain)
  const bDomain = normalizeHostname(b.domain)
  const aExact = aDomain === hostname ? 1 : 0
  const bExact = bDomain === hostname ? 1 : 0

  if (aExact !== bExact) {
    return aExact - bExact
  }
  if (Boolean(a.hostOnly) !== Boolean(b.hostOnly)) {
    return Number(Boolean(a.hostOnly)) - Number(Boolean(b.hostOnly))
  }
  if (aDomain.length !== bDomain.length) {
    return aDomain.length - bDomain.length
  }

  const aPathLength = (a.path || '/').length
  const bPathLength = (b.path || '/').length
  return aPathLength - bPathLength
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

export function normalizeCookieCloudConfig(config: CookieCloudConfig | undefined): CookieCloudConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    active: config.active === true,
    endpoint: normalizeEndpoint(config.endpoint || ''),
    uuid: normalizeString(config.uuid),
    password: normalizeString(config.password),
    cron: normalizeString(config.cron || ''),
    cryptoType: normalizeCookieCloudCryptoType(),
  }
}

export function isCookieCloudReady(config: CookieCloudConfig | undefined): boolean {
  const normalized = normalizeCookieCloudConfig(config)
  return Boolean(
    normalized?.active
    && normalized.endpoint
    && normalized.uuid
    && normalized.password,
  )
}

export async function fetchCookieCloudSnapshot(config: CookieCloudConfig): Promise<CookieCloudSnapshot> {
  const normalized = normalizeCookieCloudConfig(config)
  if (!normalized || !isCookieCloudReady(normalized)) {
    throw new Error('CookieCloud 配置不完整')
  }

  const { data } = await axios.get<CookieCloudResponse>(`${normalized.endpoint}/get/${encodeURIComponent(normalized.uuid)}`)
  if (!data?.encrypted) {
    throw new Error('CookieCloud 返回数据格式异常')
  }

  const cryptoType = normalizeCookieCloudCryptoType()
  const payload = decryptCookieCloudPayload(normalized.uuid, normalized.password, data.encrypted)
  const cookieData = typeof payload.cookie_data === 'object' && payload.cookie_data !== null
    ? payload.cookie_data as Record<string, unknown>
    : {}
  const cookies = flattenCookieData(cookieData)
  const domains = Array.from(new Set(cookies.map(item => normalizeHostname(item.domain)).filter(Boolean))).sort()

  return {
    cookies,
    cryptoType,
    domains,
    updateTime: normalizeString(payload.update_time) || undefined,
  }
}

export function buildCookieHeaderForUrl(cookies: CookieCloudCookie[], targetUrl: string): string {
  const url = new URL(targetUrl)
  const hostname = url.hostname.toLowerCase()
  const pathname = url.pathname || '/'
  const selected = new Map<string, CookieCloudCookie>()

  for (const cookie of cookies) {
    if (!domainMatches(cookie, hostname) || !pathMatches(cookie.path, pathname) || isCookieExpired(cookie)) {
      continue
    }
    if (cookie.secure && url.protocol !== 'https:') {
      continue
    }

    const current = selected.get(cookie.name)
    if (!current || compareCookieSpecificity(cookie, current, hostname) > 0) {
      selected.set(cookie.name, cookie)
    }
  }

  return Array.from(selected.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `${item.name}=${item.value}`)
    .join('; ')
}

export function createCookieDiagnostics(source: 'manual' | 'cookieCloud', mainCookie: string, yubaCookie: string, options: {
  cookieCount: number
  domains: string[]
  updateTime?: string
}): CookieDiagnostics {
  const missingMainKeys = COOKIE_CLOUD_MAIN_REQUIRED_KEYS.filter(name => !getCookieValue(mainCookie, name))
  const missingYubaKeys = COOKIE_CLOUD_YUBA_REQUIRED_KEYS.filter(name => !getCookieValue(yubaCookie, name))

  return {
    source,
    mainCookieReady: missingMainKeys.length === 0,
    yubaCookieReady: missingYubaKeys.length === 0,
    missingMainKeys,
    missingYubaKeys,
    cookieCount: options.cookieCount,
    domains: options.domains,
    updateTime: options.updateTime,
  }
}
