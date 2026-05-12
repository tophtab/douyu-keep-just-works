import { getCookieValue, makeHeaders } from './api'

export const YUBA_HOST = 'https://yuba.douyu.com'
export const YUBA_MAPI_HOST = 'https://mapi-yuba.douyu.com'

const MULTIPART_BOUNDARY_PREFIX = '----DouyuKeepBoundary'
const DOUYU_DY_TOKEN_COOKIE_KEYS = ['acf_uid', 'acf_biz', 'acf_stk', 'acf_ct', 'acf_ltkid']

export type YubaBody = Record<string, unknown>

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function hasAnyPayloadField(payload: YubaBody, names: string[]): boolean {
  return names.some(name => Object.prototype.hasOwnProperty.call(payload, name) && payload[name] !== null && payload[name] !== undefined)
}

export function assertYubaPayloadFields(payload: YubaBody, fields: Array<{ label: string; names: string[] }>, messagePrefix: string): void {
  const missingLabels = fields
    .filter(group => !hasAnyPayloadField(payload, group.names))
    .map(group => group.label)

  if (missingLabels.length > 0) {
    throw new Error(`${messagePrefix}: ${missingLabels.join(', ')}`)
  }
}

export function parseYubaBody(response: unknown, fallbackMessage: string): YubaBody {
  if (typeof response !== 'object' || response === null) {
    throw new Error(fallbackMessage)
  }
  return response as YubaBody
}

export function getYubaErrorCode(body: YubaBody): number {
  return readNumber(body.error ?? body.status_code, 0)
}

export function getYubaErrorMessage(body: YubaBody, fallbackMessage: string): string {
  return readString(body.msg ?? body.message, fallbackMessage) || fallbackMessage
}

export function createMultipartFormBody(fields: Record<string, string>): { body: string; contentType: string } {
  const boundary = `${MULTIPART_BOUNDARY_PREFIX}${Date.now().toString(16)}`
  const parts = Object.entries(fields).map(([key, value]) => {
    return `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  })

  return {
    body: `${parts.join('')}--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

export function makeYubaHeaders(cookie: string, referer: string, extraHeaders: Record<string, string> = {}) {
  return makeHeaders(cookie, {
    referer,
    origin: YUBA_HOST,
    extraHeaders,
  })
}

export function createDouyuDyToken(cookie: string): string {
  const parts = DOUYU_DY_TOKEN_COOKIE_KEYS.map(key => getCookieValue(cookie, key))
  const missingKeys = DOUYU_DY_TOKEN_COOKIE_KEYS.filter((_, index) => !parts[index])
  if (missingKeys.length > 0) {
    throw new Error(`Cookie中没有找到${missingKeys.join(', ')}，鱼吧 dy-token 签到需要完整主站登录态`)
  }

  return parts.join('_')
}

export function makeYubaDyTokenHeaders(yubaCookie: string, mainCookie: string, referer: string, extraHeaders: Record<string, string> = {}) {
  return makeYubaHeaders(yubaCookie, referer, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'dy-client': 'pc',
    'dy-token': createDouyuDyToken(mainCookie),
    ...extraHeaders,
  })
}

export function makeYubaMobileTokenHeaders(yubaCookie: string, mainCookie: string, referer: string, extraHeaders: Record<string, string> = {}) {
  return makeHeaders(yubaCookie, {
    referer,
    origin: YUBA_HOST,
    extraHeaders: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'client': 'android',
      'token': createDouyuDyToken(mainCookie),
      ...extraHeaders,
    },
  })
}

export function getYubaCsrfToken(cookie: string): string {
  const token = getCookieValue(cookie, 'acf_yb_t')
  if (!token) {
    throw new Error('Cookie中没有找到acf_yb_t，鱼吧签到需要包含鱼吧登录态')
  }
  return token
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const size = Math.max(1, Math.min(concurrency, items.length))
  const results = Array<R>(items.length)
  let nextIndex = 0

  await Promise.all(Array.from({ length: size }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }))

  return results
}
