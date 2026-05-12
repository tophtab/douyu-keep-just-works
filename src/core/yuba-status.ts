import axios from 'axios'
import {
  YUBA_HOST,
  assertYubaPayloadFields,
  errorMessage,
  getYubaErrorCode,
  getYubaErrorMessage,
  makeYubaDyTokenHeaders,
  makeYubaHeaders,
  mapWithConcurrency,
  parseYubaBody,
  readNumber,
  readString,
} from './yuba-common'
import type { YubaFollowedGroup, YubaGroupHead, YubaGroupStatus } from './types'
import type { YubaBody } from './yuba-common'

const FOLLOWED_GROUP_PAGE_LIMIT = 50

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

export async function getFollowedYubaGroupsWithDyToken(yubaCookie: string, mainCookie: string, options: {
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
