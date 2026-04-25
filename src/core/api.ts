import axios from 'axios'
import type { Fans, GiftStatus, SendGift, sendArgs } from './types'

export const DOUYU_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188'
const GLOW_STICK_GIFT_ID = 268
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

export async function getGiftStatus(cookie: string, candidateRoomIds: number[] = []): Promise<GiftStatus> {
  let lastError: Error | null = null

  for (const endpoint of buildBackpackEndpoints(candidateRoomIds)) {
    try {
      const { data } = await axios.get(endpoint, {
        headers: makeHeaders(cookie),
      })

      if (typeof data?.error === 'number' && data.error !== 0) {
        const missingKeys = getMissingBackpackCookieKeys(cookie)
        if (data.error === 9 && missingKeys.length > 0) {
          throw new Error(`获取荧光棒数量失败，主站 Cookie 缺少 ${missingKeys.join(', ')}，无法访问背包接口`)
        }
        throw new Error(`获取荧光棒数量失败，接口返回错误码 ${data.error}`)
      }

      if (!data?.data || !Array.isArray(data.data.list)) {
        throw new Error('获取荧光棒数量失败，返回数据格式异常')
      }

      const glowStickItems = data.data.list.filter((item: unknown): item is Record<string, unknown> => {
        if (typeof item !== 'object' || item === null) {
          return false
        }
        const record = item as Record<string, unknown>
        return Number(record.id) === GLOW_STICK_GIFT_ID
      })
      if (!glowStickItems.length) {
        return { count: 0 }
      }

      let count = 0
      const expireTimes: number[] = []

      for (const item of glowStickItems) {
        const itemCount = Number(item?.count ?? 0)
        if (Number.isFinite(itemCount) && itemCount > 0) {
          count += itemCount
        }

        const expireTime = normalizeUnixTimestamp(
          item?.expireTime
          ?? item?.expire_time
          ?? item?.expireAt
          ?? item?.expiresAt
          ?? item?.met
          ?? item?.endTime,
        )
        if (expireTime) {
          expireTimes.push(expireTime)
        }
      }

      return {
        count,
        // Backpack responses may contain multiple stacks. Show the earliest expiry if several exist.
        expireTime: expireTimes.length ? Math.min(...expireTimes) : undefined,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw (lastError || new Error('获取荧光棒数量失败'))
}

export async function getGiftNumber(cookie: string, candidateRoomIds: number[] = []): Promise<number> {
  const status = await getGiftStatus(cookie, candidateRoomIds)
  return status.count
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
  const data = assertDouyuBusinessSuccess(res.data, '赠送荧光棒')
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
