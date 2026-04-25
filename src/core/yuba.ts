import axios from 'axios'
import { getCookieValue, makeHeaders, sleep } from './api'
import type { YubaCheckInResult, YubaFollowedGroup, YubaGroupHead, YubaGroupStatus } from './types'

const YUBA_HOST = 'https://yuba.douyu.com'
const FOLLOWED_GROUP_PAGE_LIMIT = 50
const MULTIPART_BOUNDARY_PREFIX = '----DouyuKeepBoundary'
const YUBA_SIGN_INTERVAL_MIN_MS = 5000
const YUBA_SIGN_INTERVAL_MAX_MS = 8000
const YUBA_SIGN_EXP_FALLBACK_MAX_DELTA = 30
type YubaBody = Record<string, unknown>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parseYubaBody(response: unknown, fallbackMessage: string): YubaBody {
  if (typeof response !== 'object' || response === null) {
    throw new Error(fallbackMessage)
  }
  return response as YubaBody
}

function getYubaErrorCode(body: YubaBody): number {
  return readNumber(body.error ?? body.status_code, 0)
}

function getYubaErrorMessage(body: YubaBody, fallbackMessage: string): string {
  return readString(body.msg ?? body.message, fallbackMessage) || fallbackMessage
}

function createMultipartFormBody(fields: Record<string, string>): { body: string; contentType: string } {
  const boundary = `${MULTIPART_BOUNDARY_PREFIX}${Date.now().toString(16)}`
  const parts = Object.entries(fields).map(([key, value]) => {
    return `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  })

  return {
    body: `${parts.join('')}--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

function makeYubaHeaders(cookie: string, referer: string, extraHeaders: Record<string, string> = {}) {
  return makeHeaders(cookie, {
    referer,
    origin: YUBA_HOST,
    extraHeaders,
  })
}

export function getYubaCsrfToken(cookie: string): string {
  const token = getCookieValue(cookie, 'acf_yb_t')
  if (!token) {
    throw new Error('Cookie中没有找到acf_yb_t，鱼吧签到需要包含鱼吧登录态')
  }
  return token
}

export async function getFollowedYubaGroups(cookie: string): Promise<YubaFollowedGroup[]> {
  const groups: YubaFollowedGroup[] = []
  const seen = new Set<number>()
  let offset = 0

  while (true) {
    const { data } = await axios.get(`${YUBA_HOST}/wgapi/yubanc/api/user/getUserFollowGroupList`, {
      headers: makeYubaHeaders(cookie, `${YUBA_HOST}/mygroups`),
      params: {
        limit: FOLLOWED_GROUP_PAGE_LIMIT,
        offset,
        type: 3,
      },
    })
    const body = parseYubaBody(data, '获取关注鱼吧列表失败，返回数据格式异常')
    const errorCode = getYubaErrorCode(body)
    if (errorCode !== 0) {
      throw new Error(getYubaErrorMessage(body, '获取关注鱼吧列表失败'))
    }

    const payload = typeof body.data === 'object' && body.data !== null
      ? body.data as YubaBody
      : {}
    const list = Array.isArray(payload.list) ? payload.list : []

    for (const item of list) {
      const groupId = readNumber(item?.id)
      if (!groupId || seen.has(groupId)) {
        continue
      }

      seen.add(groupId)
      groups.push({
        groupId,
        name: readString(item?.name, String(groupId)),
        unreadFeedNum: readNumber(item?.unread_feed_num ?? item?.unreadFeedNum),
      })
    }

    const nextOffset = readNumber(payload.next_offset ?? payload.nextOffset)
    if (nextOffset <= 0 || list.length === 0) {
      break
    }
    offset = nextOffset
  }

  return groups
}

export async function getYubaGroupHead(groupId: number, cookie: string): Promise<YubaGroupHead> {
  const { data } = await axios.get(`${YUBA_HOST}/wbapi/web/group/head`, {
    headers: makeYubaHeaders(cookie, `${YUBA_HOST}/discussion/${groupId}/posts`),
    params: { group_id: groupId },
  })
  const body = parseYubaBody(data, '获取鱼吧信息失败，返回数据格式异常')
  const statusCode = readNumber(body.status_code)
  if (statusCode !== 200 || typeof body.data !== 'object' || body.data === null) {
    throw new Error(getYubaErrorMessage(body, `获取鱼吧${groupId}信息失败`))
  }

  const payload = body.data as YubaBody
  return {
    groupId,
    groupName: readString(payload.group_name ?? payload.groupName, String(groupId)),
    groupLevel: readNumber(payload.group_level ?? payload.groupLevel),
    groupExp: readNumber(payload.level_score ?? payload.levelScore ?? payload.group_exp ?? payload.groupExp),
    nextLevelExp: readNumber(payload.next_level_exp ?? payload.nextLevelExp),
    groupTitle: readString(payload.group_title ?? payload.groupTitle),
    rank: readNumber(payload.rank),
    isSigned: readNumber(payload.sign ?? payload.is_signed ?? payload.isSigned),
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
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

export async function getFollowedYubaStatuses(cookie: string): Promise<YubaGroupStatus[]> {
  const groups = await getFollowedYubaGroups(cookie)
  return await mapWithConcurrency(groups, 5, async (group) => {
    try {
      const head = await getYubaGroupHead(group.groupId, cookie)
      return {
        groupId: group.groupId,
        groupName: head.groupName || group.name,
        unreadFeedNum: group.unreadFeedNum,
        groupLevel: head.groupLevel,
        groupExp: head.groupExp,
        nextLevelExp: head.nextLevelExp,
        groupTitle: head.groupTitle,
        rank: head.rank,
        isSigned: head.isSigned,
      }
    } catch (error) {
      return {
        groupId: group.groupId,
        groupName: group.name,
        unreadFeedNum: group.unreadFeedNum,
        error: errorMessage(error),
      }
    }
  })
}

export async function signYubaGroup(groupId: number, curExp: number, cookie: string): Promise<'signed' | 'already_signed'> {
  const csrfToken = getYubaCsrfToken(cookie)
  const formData = createMultipartFormBody({
    group_id: String(groupId),
    cur_exp: String(Math.max(0, curExp)),
  })

  const { data } = await axios.post(`${YUBA_HOST}/ybapi/topic/sign`, formData.body, {
    headers: makeYubaHeaders(cookie, `${YUBA_HOST}/discussion/${groupId}/posts`, {
      'Content-Type': formData.contentType,
      'X-CSRF-TOKEN': csrfToken,
    }),
  })

  const body = parseYubaBody(data, '鱼吧签到失败，返回数据格式异常')
  const statusCode = readNumber(body.status_code)
  const errorCode = readNumber(body.error)
  const message = getYubaErrorMessage(body, '')
  if (statusCode === 3004 || errorCode === 3004 || message.includes('Gee')) {
    throw new Error('鱼吧签到触发 Gee 验证，当前纯 HTTP 方案无法继续执行')
  }
  if (statusCode === 4206 || errorCode === 4206 || message.includes('未登录')) {
    throw new Error('鱼吧签到接口返回未登录，请检查鱼吧登录态是否失效')
  }
  if (message.includes('今日已签到') || message.includes('已经签到') || message.includes('已签到')) {
    return 'already_signed'
  }
  if (message.includes('签到成功')) {
    return 'signed'
  }
  if (statusCode === 200 || errorCode === 200) {
    return 'signed'
  }
  throw new Error(getYubaErrorMessage(body, `鱼吧${groupId}签到失败`))
}

async function retryYubaSignWithExpFallback(groupId: number, baseExp: number, cookie: string): Promise<{
  result: 'signed' | 'already_signed'
  usedExp: number
} | null> {
  const normalizedBaseExp = Math.max(0, baseExp)
  const maxDelta = Math.min(YUBA_SIGN_EXP_FALLBACK_MAX_DELTA, normalizedBaseExp)

  for (let delta = 1; delta <= maxDelta; delta += 1) {
    const candidateExp = normalizedBaseExp - delta

    try {
      return {
        result: await signYubaGroup(groupId, candidateExp, cookie),
        usedExp: candidateExp,
      }
    } catch (error) {
      const message = errorMessage(error)
      if (!shouldRetryYubaSign(message)) {
        throw error
      }
    }
  }

  return null
}

function shouldStopAfterYubaFailure(message: string): boolean {
  return message.includes('Gee')
    || message.includes('登录')
    || message.includes('Cookie')
    || message.includes('acf_yb_t')
    || message.includes('token')
}

function shouldRetryYubaSign(message: string): boolean {
  return message.includes('签到失败')
    && !message.includes('关闭')
    && !message.includes('不存在')
    && !shouldStopAfterYubaFailure(message)
}

function shouldSkipClosedYuba(message: string): boolean {
  return message.includes('被关闭')
    || message.includes('不存在')
}

function getYubaSignIntervalMs(): number {
  const min = Math.max(0, YUBA_SIGN_INTERVAL_MIN_MS)
  const max = Math.max(min, YUBA_SIGN_INTERVAL_MAX_MS)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function executeFollowedYubaCheckIn(cookie: string, log: (message: string) => void): Promise<YubaCheckInResult> {
  log('正在获取关注鱼吧列表...')
  const groups = await getFollowedYubaGroups(cookie)
  if (groups.length === 0) {
    log('当前没有关注的鱼吧，结束任务')
    return {
      signedCount: 0,
      alreadySignedCount: 0,
      failedCount: 0,
      stoppedEarly: false,
    }
  }

  log(`已获取 ${groups.length} 个关注鱼吧`)
  let signedCount = 0
  let alreadySignedCount = 0
  let failedCount = 0
  let stoppedEarly = false

  for (const [index, group] of groups.entries()) {
    try {
      let head = await getYubaGroupHead(group.groupId, cookie)
      let result: 'signed' | 'already_signed'
      let fallbackExpUsed: number | null = null

      try {
        result = await signYubaGroup(group.groupId, head.groupExp, cookie)
      } catch (error) {
        const message = errorMessage(error)
        if (!shouldRetryYubaSign(message)) {
          throw error
        }

        log(`鱼吧 ${head.groupName}(${group.groupId}) 首次签到失败，正在刷新经验值后重试`)
        head = await getYubaGroupHead(group.groupId, cookie)

        try {
          result = await signYubaGroup(group.groupId, head.groupExp, cookie)
        } catch (retryError) {
          const retryMessage = errorMessage(retryError)
          if (!shouldRetryYubaSign(retryMessage)) {
            throw retryError
          }

          const fallbackResult = await retryYubaSignWithExpFallback(group.groupId, head.groupExp, cookie)
          if (!fallbackResult) {
            throw retryError
          }

          result = fallbackResult.result
          fallbackExpUsed = fallbackResult.usedExp
        }
      }

      if (fallbackExpUsed !== null) {
        log(`鱼吧 ${head.groupName}(${group.groupId}) 回退经验值 ${head.groupExp} -> ${fallbackExpUsed} 后恢复签到`)
      }

      if (result === 'already_signed') {
        alreadySignedCount += 1
        log(`鱼吧 ${head.groupName}(${group.groupId}) 接口返回今日已签到`)
      } else {
        signedCount += 1
        log(`鱼吧 ${head.groupName}(${group.groupId}) 签到成功`)
      }
    } catch (error) {
      const message = errorMessage(error)
      if (shouldSkipClosedYuba(message)) {
        log(`鱼吧 ${group.name}(${group.groupId}) 已关闭或不存在，跳过后续签到`)
        continue
      }

      failedCount += 1
      log(`鱼吧 ${group.name}(${group.groupId}) 签到失败: ${message}`)
      if (shouldStopAfterYubaFailure(message)) {
        stoppedEarly = true
        log('检测到登录态、CSRF 或 Gee 风控问题，本轮鱼吧签到提前结束')
        break
      }
    }

    if (index < groups.length - 1) {
      await sleep(getYubaSignIntervalMs())
    }
  }

  log(`鱼吧签到任务完成: 成功 ${signedCount}，已签到 ${alreadySignedCount}，失败 ${failedCount}${stoppedEarly ? '，已提前停止' : ''}`)
  return {
    signedCount,
    alreadySignedCount,
    failedCount,
    stoppedEarly,
  }
}

export function formatYubaModeLabel(mode: string | undefined): string {
  return mode === 'followed' || !mode ? '签到全部已关注鱼吧' : mode
}
