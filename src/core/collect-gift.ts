import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import WebSocket from 'ws'
import { DOUYU_USER_AGENT, getCookieValue } from './api'

const DOUYU_DANMU_WS_URL = 'wss://wsproxy.douyu.com:6672'
const DOUYU_LOGIN_VK_SECRET = 'r5*^5;}2#${XF[h+;\'./.Q\'1;,-]f\'p['
const COLLECT_TIMEOUT_MS = 15000
const LOGIN_COOKIE_KEYS = ['acf_username', 'acf_ltkid', 'acf_biz', 'acf_stk', 'acf_ct']

function escapeDouyuValue(value: string): string {
  return value.replace(/@/g, '@A').replace(/\//g, '@S')
}

function encodeDouyuMessage(params: Record<string, string>): string {
  const payload = Object.entries(params)
    .map(([key, value]) => `${escapeDouyuValue(key)}@=${escapeDouyuValue(value)}/`)
    .join('')

  return `${payload}\0`
}

function generateDouyuPacket(message: string): Buffer {
  const payload = Buffer.from(message, 'utf8')
  const packet = Buffer.alloc(12 + payload.length + 1)
  const length = 9 + payload.length

  packet.writeInt32LE(length, 0)
  packet.writeInt32LE(length, 4)
  packet.writeInt32LE(689, 8)
  payload.copy(packet, 12)
  packet.writeUInt8(0, 12 + payload.length)

  return packet
}

function decodeDouyuMessages(data: WebSocket.RawData): string[] {
  const buffer = Buffer.isBuffer(data)
    ? data
    : Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.from(data)

  return Array.from(buffer.toString('utf8').matchAll(/type@=.*?\0/g), match => match[0].slice(0, -1))
}

function randomDeviceId(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.randomBytes(31)
  let suffix = ''
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length]
  }

  return `b${suffix}`
}

function getMissingLoginCookieKeys(cookie: string): string[] {
  return LOGIN_COOKIE_KEYS.filter(key => !getCookieValue(cookie, key))
}

function buildLoginPacket(roomId: string, cookie: string): Buffer {
  const deviceId = randomDeviceId()
  const timestamp = String(Math.floor(Date.now() / 1000))
  const vk = crypto
    .createHash('md5')
    .update(`${timestamp}${DOUYU_LOGIN_VK_SECRET}${deviceId}`)
    .digest('hex')

  const params: Record<string, string> = {
    type: 'loginreq',
    password: '',
    roomid: roomId,
  }

  const cookieMappings: Array<[string, string]> = [
    ['acf_username', 'username'],
    ['acf_ltkid', 'ltkid'],
    ['acf_biz', 'biz'],
    ['acf_stk', 'stk'],
    ['acf_ct', 'ct'],
  ]

  for (const [cookieKey, paramKey] of cookieMappings) {
    const value = getCookieValue(cookie, cookieKey)
    if (value) {
      params[paramKey] = value
    }
  }

  Object.assign(params, {
    devid: deviceId,
    rt: timestamp,
    pt: '2',
    vk,
    ver: '20180222',
    aver: '219032101',
    dmbt: 'mobile safari',
    dmbv: '11',
  })

  return generateDouyuPacket(encodeDouyuMessage(params))
}

function buildEnterRoomPacket(roomId: string): Buffer {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return generateDouyuPacket(encodeDouyuMessage({
    type: 'h5ckreq',
    rid: roomId,
    ti: `2501${year}${month}${day}`,
  }))
}

export async function collectGiftViaDanmu(cookie: string, roomId: number | string): Promise<void> {
  const normalizedRoomId = String(roomId).trim()
  if (!/^\d+$/.test(normalizedRoomId)) {
    throw new Error(`领取荧光棒失败: 无效的粉丝牌房间号 ${normalizedRoomId || '<empty>'}`)
  }

  const missingCookieKeys = getMissingLoginCookieKeys(cookie)

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let loginAccepted = false
    let timer: ReturnType<typeof setTimeout>
    const ws = new WebSocket(DOUYU_DANMU_WS_URL, {
      handshakeTimeout: 10000,
      headers: {
        'Cookie': cookie,
        'User-Agent': DOUYU_USER_AGENT,
        'Origin': 'https://www.douyu.com',
        'Referer': `https://www.douyu.com/${normalizedRoomId}`,
      },
    })

    const finish = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      ws.close()

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    timer = setTimeout(() => {
      finish(new Error('领取荧光棒失败: 等待斗鱼弹幕连接响应超时'))
    }, COLLECT_TIMEOUT_MS)

    ws.on('open', () => {
      ws.send(buildLoginPacket(normalizedRoomId, cookie))
    })

    ws.on('message', (data) => {
      for (const message of decodeDouyuMessages(data)) {
        if (message.startsWith('type@=loginres')) {
          if (message.includes('roomgroup@=1')) {
            loginAccepted = true
            ws.send(buildEnterRoomPacket(normalizedRoomId))
          } else {
            const missing = missingCookieKeys.length ? `，缺少 ${missingCookieKeys.join(', ')}` : ''
            finish(new Error(`领取荧光棒失败: Cookie 弹幕鉴权失败${missing}`))
          }
        }

        if (message.startsWith('type@=h5ckres')) {
          finish()
        }
      }
    })

    ws.on('error', (error) => {
      finish(new Error(`领取荧光棒失败: ${error.message}`))
    })

    ws.on('close', () => {
      if (!settled) {
        const suffix = loginAccepted ? '进入房间前连接关闭' : '登录前连接关闭'
        finish(new Error(`领取荧光棒失败: 斗鱼弹幕连接${suffix}`))
      }
    })
  })
}
