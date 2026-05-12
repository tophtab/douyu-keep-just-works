import axios from 'axios'
import { sleep } from './api'
import {
  YUBA_HOST,
  YUBA_MAPI_HOST,
  createMultipartFormBody,
  errorMessage,
  getYubaCsrfToken,
  getYubaErrorMessage,
  makeYubaDyTokenHeaders,
  makeYubaHeaders,
  makeYubaMobileTokenHeaders,
  parseYubaBody,
  readNumber,
} from './yuba-common'
import { getFollowedYubaGroupsWithDyToken } from './yuba-status'
import type { YubaBody } from './yuba-common'
import type { YubaCheckInResult } from './types'

const YUBA_SIGN_INTERVAL_MIN_MS = 5000
const YUBA_SIGN_INTERVAL_MAX_MS = 8000
const YUBA_SUPPLEMENTARY_MAX_ATTEMPTS = 10

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
