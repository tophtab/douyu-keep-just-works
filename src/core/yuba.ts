import axios from 'axios'
import { sleep } from './api'
import {
  YUBA_HOST,
  YUBA_MAPI_HOST,
  assertYubaPayloadFields,
  createMultipartFormBody,
  errorMessage,
  getYubaCsrfToken,
  getYubaErrorCode,
  getYubaErrorMessage,
  makeYubaDyTokenHeaders,
  makeYubaHeaders,
  makeYubaMobileTokenHeaders,
  mapWithConcurrency,
  parseYubaBody,
  readNumber,
  readString,
} from './yuba-common'
import type { YubaCheckInResult, YubaFollowedGroup, YubaGroupHead, YubaGroupStatus } from './types'
import type { YubaBody } from './yuba-common'

export { createDouyuDyToken, getYubaCsrfToken } from './yuba-common'

const FOLLOWED_GROUP_PAGE_LIMIT = 50
const YUBA_SIGN_INTERVAL_MIN_MS = 5000
const YUBA_SIGN_INTERVAL_MAX_MS = 8000
const YUBA_SUPPLEMENTARY_MAX_ATTEMPTS = 10

const YUBA_GROUP_HEAD_STATUS_FIELDS: Array<{ label: string; names: string[] }> = [
  { label: 'groupName', names: ['group_name', 'groupName'] },
  { label: 'groupLevel', names: ['group_level', 'groupLevel'] },
  { label: 'groupExp', names: ['level_score', 'levelScore', 'group_exp', 'groupExp'] },
  { label: 'nextLevelExp', names: ['next_level_exp', 'nextLevelExp', 'max_score', 'maxScore'] },
  { label: 'groupTitle', names: ['group_title', 'groupTitle'] },
  { label: 'rank', names: ['rank'] },
  { label: 'isSigned', names: ['sign', 'is_signed', 'isSigned'] },
]

const YUBA_FOLLOWED_GROUP_STATUS_FIELDS: Array<{ label: string; names: string[] }> = [
  { label: 'groupId', names: ['group_id', 'id'] },
  { label: 'groupName', names: ['group_name', 'name'] },
  { label: 'unreadFeedNum', names: ['unread', 'unread_feed_num', 'unreadFeedNum'] },
]

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

async function getFollowedYubaGroupsWithDyToken(yubaCookie: string, mainCookie: string, options: {
  requireStatusFields?: boolean
} = {}): Promise<YubaFollowedGroup[]> {
  const groups: YubaFollowedGroup[] = []
  const seen = new Set<number>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const { data } = await axios.get(`${YUBA_HOST}/wbapi/web/group/myFollow`, {
      headers: makeYubaDyTokenHeaders(yubaCookie, mainCookie, `${YUBA_HOST}/mygroups`),
      params: {
        page,
        limit: 30,
      },
    })
    const body = parseYubaBody(data, '获取关注鱼吧列表失败，返回数据格式异常')
    const statusCode = readNumber(body.status_code)
    if (statusCode !== 200) {
      throw new Error(getYubaErrorMessage(body, '获取关注鱼吧列表失败'))
    }

    const payload = typeof body.data === 'object' && body.data !== null
      ? body.data as YubaBody
      : {}
    const list = Array.isArray(payload.list) ? payload.list : []

    for (const item of list) {
      if (typeof item !== 'object' || item === null) {
        continue
      }

      const payload = item as YubaBody
      if (options.requireStatusFields) {
        assertYubaPayloadFields(payload, YUBA_FOLLOWED_GROUP_STATUS_FIELDS, 'dy-token 鱼吧列表缺少当前列表字段')
      }

      const groupId = readNumber(payload.group_id ?? payload.id)
      if (!groupId || seen.has(groupId)) {
        continue
      }

      seen.add(groupId)
      groups.push({
        groupId,
        name: readString(payload.group_name ?? payload.name, String(groupId)),
        unreadFeedNum: readNumber(payload.unread ?? payload.unread_feed_num ?? payload.unreadFeedNum),
      })
    }

    totalPages = Math.max(1, readNumber(payload.count_page ?? payload.countPage, totalPages))
    if (list.length === 0) {
      break
    }
    page += 1
  }

  return groups
}

export async function getYubaGroupHead(groupId: number, cookie: string): Promise<YubaGroupHead> {
  const { data } = await axios.get(`${YUBA_HOST}/wbapi/web/group/head`, {
    headers: makeYubaHeaders(cookie, `${YUBA_HOST}/discussion/${groupId}/posts`),
    params: { group_id: groupId },
  })
  return parseYubaGroupHead(groupId, data)
}

async function getYubaGroupHeadWithDyToken(groupId: number, yubaCookie: string, mainCookie: string): Promise<YubaGroupHead> {
  const { data } = await axios.get(`${YUBA_HOST}/wbapi/web/group/head`, {
    headers: makeYubaDyTokenHeaders(yubaCookie, mainCookie, `${YUBA_HOST}/discussion/${groupId}/posts`),
    params: { group_id: groupId },
  })
  return parseYubaGroupHead(groupId, data, { requireRenderedFields: true })
}

function assertYubaGroupHeadRenderedFields(payload: YubaBody): void {
  assertYubaPayloadFields(payload, YUBA_GROUP_HEAD_STATUS_FIELDS, 'dy-token 鱼吧状态缺少当前列表字段')
}

function parseYubaGroupHead(groupId: number, data: unknown, options: {
  requireRenderedFields?: boolean
} = {}): YubaGroupHead {
  const body = parseYubaBody(data, '获取鱼吧信息失败，返回数据格式异常')
  const statusCode = readNumber(body.status_code)
  if (statusCode !== 200 || typeof body.data !== 'object' || body.data === null) {
    throw new Error(getYubaErrorMessage(body, `获取鱼吧${groupId}信息失败`))
  }

  const payload = body.data as YubaBody
  if (options.requireRenderedFields) {
    assertYubaGroupHeadRenderedFields(payload)
  }
  return {
    groupId,
    groupName: readString(payload.group_name ?? payload.groupName, String(groupId)),
    groupLevel: readNumber(payload.group_level ?? payload.groupLevel),
    groupExp: readNumber(payload.level_score ?? payload.levelScore ?? payload.group_exp ?? payload.groupExp),
    nextLevelExp: readNumber(payload.next_level_exp ?? payload.nextLevelExp ?? payload.max_score ?? payload.maxScore),
    groupTitle: readString(payload.group_title ?? payload.groupTitle),
    rank: readNumber(payload.rank),
    isSigned: readNumber(payload.sign ?? payload.is_signed ?? payload.isSigned),
  }
}

async function getYubaStatusesForGroups(
  groups: YubaFollowedGroup[],
  getHead: (groupId: number) => Promise<YubaGroupHead>,
): Promise<YubaGroupStatus[]> {
  return await mapWithConcurrency(groups, 5, async (group) => {
    try {
      const head = await getHead(group.groupId)
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

export async function getFollowedYubaStatuses(cookie: string): Promise<YubaGroupStatus[]> {
  const groups = await getFollowedYubaGroups(cookie)
  return await getYubaStatusesForGroups(groups, groupId => getYubaGroupHead(groupId, cookie))
}

export async function getFollowedYubaStatusesWithDyToken(yubaCookie: string, mainCookie: string): Promise<YubaGroupStatus[]> {
  let groups: YubaFollowedGroup[]
  try {
    groups = await getFollowedYubaGroupsWithDyToken(yubaCookie, mainCookie, { requireStatusFields: true })
  } catch (dyTokenError) {
    const message = errorMessage(dyTokenError)
    if (message.includes('Cookie中没有找到') && message.includes('dy-token')) {
      throw dyTokenError
    }

    try {
      return await getFollowedYubaStatuses(yubaCookie)
    } catch (fallbackError) {
      throw new Error(`${message}；鱼吧 Cookie 兜底也失败: ${errorMessage(fallbackError)}`)
    }
  }

  return await getYubaStatusesForGroups(groups, async (groupId) => {
    try {
      return await getYubaGroupHeadWithDyToken(groupId, yubaCookie, mainCookie)
    } catch (dyTokenError) {
      try {
        return await getYubaGroupHead(groupId, yubaCookie)
      } catch (fallbackError) {
        throw new Error(`${errorMessage(dyTokenError)}；鱼吧 Cookie 兜底也失败: ${errorMessage(fallbackError)}`)
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

async function signYubaGroupWithDyToken(groupId: number, yubaCookie: string, mainCookie: string): Promise<'signed' | 'already_signed'> {
  const { data } = await axios.post(`${YUBA_HOST}/ybapi/topic/sign`, `group_id=${encodeURIComponent(String(groupId))}`, {
    headers: makeYubaDyTokenHeaders(yubaCookie, mainCookie, `${YUBA_HOST}/group/${groupId}`),
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
  if ((statusCode === 200 || errorCode === 200 || message === '') && typeof body.data === 'object' && body.data !== null) {
    return 'signed'
  }
  throw new Error(getYubaErrorMessage(body, `鱼吧${groupId}签到失败`))
}

async function fastSignYuba(yubaCookie: string, mainCookie: string): Promise<{ signed: boolean; message: string }> {
  const { data } = await axios.post(`${YUBA_MAPI_HOST}/wb/v3/fastSign`, '', {
    headers: makeYubaMobileTokenHeaders(yubaCookie, mainCookie, `${YUBA_HOST}/mygroups`),
  })

  const body = parseYubaBody(data, '鱼吧极速签到失败，返回数据格式异常')
  const statusCode = readNumber(body.status_code)
  const errorCode = readNumber(body.error)
  const message = getYubaErrorMessage(body, '')
  if ((statusCode && statusCode !== 200) || (errorCode && errorCode !== 0)) {
    throw new Error(getYubaErrorMessage(body, '鱼吧极速签到失败'))
  }

  return {
    signed: message === '' && readNumber(body.data) !== 0,
    message: message || (readNumber(body.data) === 0 ? '没有7级以上的鱼吧或极速签到已完成' : '极速签到完成'),
  }
}

async function supplementYubaGroup(groupId: number, yubaCookie: string, mainCookie: string): Promise<{
  attempts: number
  skippedReason?: string
}> {
  let attempts = 0
  let remaining = 1

  while (remaining > 0 && attempts < YUBA_SUPPLEMENTARY_MAX_ATTEMPTS) {
    attempts += 1
    const { data } = await axios.post(`${YUBA_MAPI_HOST}/wb/v3/supplement`, `group_id=${encodeURIComponent(String(groupId))}`, {
      headers: makeYubaMobileTokenHeaders(yubaCookie, mainCookie, `${YUBA_HOST}/group/${groupId}`),
    })

    const body = parseYubaBody(data, '鱼吧补签失败，返回数据格式异常')
    const statusCode = readNumber(body.status_code)
    const errorCode = readNumber(body.error)
    const message = getYubaErrorMessage(body, '')
    if (statusCode === 1001 && message.includes('补签失败')) {
      return {
        attempts: 0,
        skippedReason: '补签接口返回补签失败，可能没有可用补签机会',
      }
    }
    if ((statusCode && statusCode !== 200) || (errorCode && errorCode !== 0)) {
      throw new Error(getYubaErrorMessage(body, `鱼吧${groupId}补签失败`))
    }

    const payload = typeof body.data === 'object' && body.data !== null ? body.data as YubaBody : {}
    remaining = readNumber(payload.supplementary_cards)
  }

  return { attempts }
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
  return await executeFollowedYubaCheckInWithDyToken(cookie, cookie, log)
}

export async function executeFollowedYubaCheckInWithDyToken(yubaCookie: string, mainCookie: string, log: (message: string) => void): Promise<YubaCheckInResult> {
  log('正在获取关注鱼吧列表...')
  const groups = await getFollowedYubaGroupsWithDyToken(yubaCookie, mainCookie)
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
  try {
    const fastResult = await fastSignYuba(yubaCookie, mainCookie)
    log(fastResult.signed ? `鱼吧极速签到完成: ${fastResult.message}` : `鱼吧极速签到跳过: ${fastResult.message}`)
  } catch (error) {
    log(`鱼吧极速签到失败，继续逐个签到: ${errorMessage(error)}`)
  }

  let signedCount = 0
  let alreadySignedCount = 0
  let failedCount = 0
  let stoppedEarly = false
  let supplementarySkipLogged = false

  for (const [index, group] of groups.entries()) {
    try {
      let result: 'signed' | 'already_signed'

      try {
        result = await signYubaGroupWithDyToken(group.groupId, yubaCookie, mainCookie)
      } catch (error) {
        const message = errorMessage(error)
        if (!shouldRetryYubaSign(message)) {
          throw error
        }

        log(`鱼吧 ${group.name}(${group.groupId}) 首次签到失败，正在按 dy-token 方案重试`)
        await sleep(2000)
        result = await signYubaGroupWithDyToken(group.groupId, yubaCookie, mainCookie)
      }

      if (result === 'already_signed') {
        alreadySignedCount += 1
        log(`鱼吧 ${group.name}(${group.groupId}) 接口返回今日已签到`)
      } else {
        signedCount += 1
        log(`鱼吧 ${group.name}(${group.groupId}) 签到成功`)
      }

      try {
        const supplementResult = await supplementYubaGroup(group.groupId, yubaCookie, mainCookie)
        if (supplementResult.attempts > 0) {
          log(`鱼吧 ${group.name}(${group.groupId}) 补签检查完成，调用 ${supplementResult.attempts} 次`)
        } else if (supplementResult.skippedReason && !supplementarySkipLogged) {
          log(`鱼吧补签跳过: ${supplementResult.skippedReason}`)
          supplementarySkipLogged = true
        }
      } catch (supplementError) {
        log(`鱼吧 ${group.name}(${group.groupId}) 补签失败: ${errorMessage(supplementError)}`)
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
