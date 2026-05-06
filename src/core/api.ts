import axios from 'axios'
import type { BackpackGiftRow, BackpackStatus, Fans, GiftStatus, SendGift, sendArgs } from './types'

export const DOUYU_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188'
export const GLOW_STICK_GIFT_ID = 268
const BACKPACK_REQUIRED_COOKIE_KEYS = ['acf_auth', 'acf_stk']
export const DEFAULT_BACKPACK_ROOM_IDS = [217331, 557171]

export function makeHeaders(cookie: string, options: {
  referer?: string
  origin?: string
  extraHeaders?: Record<string, string>
} = {}) {
  return {
    'Cookie': cookie,
    'User-Agent': DOUYU_USER_AGENT,
    'Referer': options.referer || 'https://www.douyu.com/',
    'Origin': options.origin || '*',
    ...(options.extraHeaders || {}),
  }
}

export function parseCookieRecord(cookie: string): Record<string, string> {
  return cookie.split(';').reduce((acc, chunk) => {
    const [name, ...rest] = chunk.trim().split('=')
    const key = name?.trim()
    if (!key) {
      return acc
    }
    acc[key] = rest.join('=').trim()
    return acc
  }, {} as Record<string, string>)
}

export function getCookieValue(cookie: string, name: string): string | undefined {
  return parseCookieRecord(cookie)[name]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readResponseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

function readResponseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readBackpackString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function getDouyuResponseMessage(data: Record<string, unknown>, fallback: string): string {
  const nestedData = isRecord(data.data) ? data.data : {}
  return readResponseString(data.msg)
    || readResponseString(data.message)
    || readResponseString(data.error_msg)
    || readResponseString(nestedData.msg)
    || readResponseString(nestedData.message)
    || fallback
}

function assertDouyuBusinessSuccess(data: unknown, action: string): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new Error(`${action}失败，返回数据格式异常`)
  }

  const errorCode = readResponseNumber(data.error)
  if (errorCode !== undefined && errorCode !== 0) {
    throw new Error(`${action}失败，接口返回错误码 ${errorCode}: ${getDouyuResponseMessage(data, '无错误信息')}`)
  }

  const code = readResponseNumber(data.code ?? data.status_code)
  if (code !== undefined && code !== 0 && code !== 200) {
    throw new Error(`${action}失败，接口返回状态码 ${code}: ${getDouyuResponseMessage(data, '无错误信息')}`)
  }

  return data
}

function getMissingBackpackCookieKeys(cookie: string): string[] {
  return BACKPACK_REQUIRED_COOKIE_KEYS.filter(name => !getCookieValue(cookie, name))
}

export function buildBackpackEndpoints(candidateRoomIds: number[] = []): string[] {
  const roomIds = Array.from(new Set([
    ...DEFAULT_BACKPACK_ROOM_IDS,
    ...candidateRoomIds.filter(roomId => Number.isInteger(roomId) && roomId > 0),
  ]))

  return roomIds.flatMap(roomId => [
    `https://www.douyu.com/japi/prop/backpack/web/v5?rid=${roomId}`,
    `https://www.douyu.com/japi/prop/backpack/web/v1?rid=${roomId}`,
  ])
}

function normalizeUnixTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed < 1e12 ? parsed * 1000 : parsed
}

function hasBatchInfo(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  return Object.keys(value).length > 0
}

function readBackpackNumber(value: unknown, fallback = 0): number {
  const parsed = readResponseNumber(value)
  return parsed === undefined ? fallback : parsed
}

function readBackpackBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  const text = readBackpackString(value).toLowerCase()
  return text === '1' || text === 'true' || text === 'yes'
}

function normalizeBackpackRow(item: Record<string, unknown>): BackpackGiftRow {
  const expiry = readResponseNumber(item.expiry)
  const expireTime = normalizeUnixTimestamp(
    item.expireTime
    ?? item.expire_time
    ?? item.expireAt
    ?? item.expiresAt
    ?? item.met
    ?? item.endTime,
  )

  return {
    giftId: readBackpackNumber(item.id),
    name: readBackpackString(item.name),
    count: readBackpackNumber(item.count),
    ...(expiry !== undefined ? { expiry, expiryDays: expiry } : {}),
    ...(expireTime !== undefined ? { expireTime } : {}),
    batchInfoPresent: hasBatchInfo(item.batchInfo),
    isValuable: readBackpackBoolean(item.isValuable),
    price: readBackpackNumber(item.price),
    intimacy: readBackpackNumber(item.intimate ?? item.intimacy),
  }
}

function summarizeGlowSticks(rows: BackpackGiftRow[]): Pick<BackpackStatus, 'glowStickCount' | 'glowStickExpireTime'> {
  const expireTimes: number[] = []
  let glowStickCount = 0

  for (const row of rows) {
    if (row.giftId !== GLOW_STICK_GIFT_ID) {
      continue
    }
    if (Number.isFinite(row.count) && row.count > 0) {
      glowStickCount += row.count
    }
    if (row.expireTime) {
      expireTimes.push(row.expireTime)
    }
  }

  return {
    glowStickCount,
    glowStickExpireTime: expireTimes.length ? Math.min(...expireTimes) : undefined,
  }
}

export async function getBackpackStatus(cookie: string, candidateRoomIds: number[] = []): Promise<BackpackStatus> {
  let lastError: Error | null = null

  for (const endpoint of buildBackpackEndpoints(candidateRoomIds)) {
    try {
      const { data } = await axios.get(endpoint, {
        headers: makeHeaders(cookie),
      })

      const dataRecord = isRecord(data) ? data : null
      const errorCode = dataRecord ? readResponseNumber(dataRecord.error) : undefined
      if (errorCode !== undefined && errorCode !== 0) {
        const missingKeys = getMissingBackpackCookieKeys(cookie)
        if (errorCode === 9 && missingKeys.length > 0) {
          throw new Error(`获取背包明细失败，主站 Cookie 缺少 ${missingKeys.join(', ')}，无法访问背包接口`)
        }
        throw new Error(`获取背包明细失败，接口返回错误码 ${errorCode}: ${getDouyuResponseMessage(dataRecord || {}, '无错误信息')}`)
      }

      if (!data?.data || !Array.isArray(data.data.list)) {
        throw new Error('获取背包明细失败，返回数据格式异常')
      }

      const rows = data.data.list
        .filter((item: unknown): item is Record<string, unknown> => isRecord(item))
        .map(normalizeBackpackRow)
      const summary = summarizeGlowSticks(rows)

      return {
        rows,
        totalRows: rows.length,
        ...summary,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw (lastError || new Error('获取背包明细失败'))
}

export async function getGiftStatus(cookie: string, candidateRoomIds: number[] = []): Promise<GiftStatus> {
  const status = await getBackpackStatus(cookie, candidateRoomIds)
  return {
    count: status.glowStickCount,
    // Backpack responses may contain multiple stacks. Show the earliest expiry if several exist.
    expireTime: status.glowStickExpireTime,
    rows: status.rows,
    totalRows: status.totalRows,
  }
}

export async function getGiftNumber(cookie: string, candidateRoomIds: number[] = []): Promise<number> {
  const status = await getGiftStatus(cookie, candidateRoomIds)
  return status.count ?? 0
}

export async function sendGift(args: sendArgs, job: SendGift, cookie: string): Promise<string> {
  const formData = new URLSearchParams()
  formData.append('rid', String(job.roomId))
  formData.append('prop_id', String(job.giftId))
  formData.append('num', String(job.count))
  formData.append('sid', args.sid!)
  formData.append('did', args.did!)
  formData.append('dy', args.dy!)
  const res = await axios.post('https://www.douyu.com/member/prop/send', formData.toString(), {
    headers: {
      ...makeHeaders(cookie),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const data = assertDouyuBusinessSuccess(res.data, `赠送礼物(ID ${job.giftId})`)
  return JSON.stringify(data)
}

export async function getDid(roomId: string, cookie: string): Promise<string> {
  const res = await axios.get(`https://www.douyu.com/${roomId}`, {
    headers: makeHeaders(cookie),
  })
  const did1: string | undefined = res.data.match(/owner_uid =(.*?);/)?.[1]?.trim()
  const did2: string | undefined = res.data.match(/owner_uid:(.*?),/)?.[1]?.trim()
  if (did1 !== undefined) {
    return did1
  }
  if (did2 !== undefined) {
    return did2
  }
  throw new Error('获取did失败')
}

export async function getFansList(cookie: string): Promise<Fans[]> {
  const res = await axios.get('https://www.douyu.com/member/cp/getFansBadgeList', {
    headers: makeHeaders(cookie),
  })
  if (typeof res.data !== 'string') {
    throw new TypeError('获取粉丝牌列表失败，返回数据格式异常')
  }

  const table = res.data.match(/fans-badge-list">([\S\s]*?)<\/table>/)?.[1]
  if (!table) {
    throw new Error('获取粉丝牌列表失败，未找到粉丝牌表格，请检查主站 Cookie 是否有效')
  }

  const list = table.match(/<tr([\s\S]*?)<\/tr>/g)
  list?.shift()
  const fans: Fans[] = list?.map((item: string) => {
    const tds = item.match(/<td([\s\S]*?)<\/td>/g)
    const name = item.match(/data-anchor_name="([\S\s]+?)"/)?.[1]
    const roomId = item.match(/data-fans-room="(\d+)"/)?.[1]
    const level = item.match(/data-fans-level="(\d+)"/)?.[1]
    const rank = item.match(/data-fans-rank="(\d+)"/)?.[1]
    if (!tds || tds.length < 4 || !name || !roomId || !level || !rank) {
      throw new Error('获取粉丝牌列表失败，返回数据格式异常')
    }

    return {
      name: String(name),
      roomId: Number(roomId),
      level: Number(level),
      rank: Number(rank),
      intimacy: String(tds[2].replace(/<([\s\S]*?)>/g, '').trim()),
      today: Number(tds[3].replace(/<([\s\S]*?)>/g, '').trim()),
    }
  }) ?? []
  return fans.sort((a, b) => b.level - a.level)
}

export function parseDyAndSidFromCookie(cookie: string): sendArgs {
  const sid = getCookieValue(cookie, 'acf_uid')
  const dy = getCookieValue(cookie, 'dy_did')
  if (!sid || !dy) {
    throw new Error('Cookie中没有找到acf_uid(sid)和dy_did(dy)')
  }
  return { sid, dy }
}

export function sleep(time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time))
}
