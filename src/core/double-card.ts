import axios from 'axios'
import type { DoubleCardInfo } from './types'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188'

interface DoubleCardApiItem {
  expireTime?: unknown
  type?: unknown
}

interface ActiveDoubleCardApiItem {
  expireTime: number
  type: 1
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isActiveDoubleCard(item: DoubleCardApiItem, now: number): item is ActiveDoubleCardApiItem {
  return item.type === 1
    && typeof item.expireTime === 'number'
    && item.expireTime > now
}

export async function checkDoubleCard(roomId: number, cookie: string): Promise<DoubleCardInfo> {
  try {
    const { data } = await axios.get(
      `https://www.douyu.com/japi/interact/cdn/pocket/effective?rid=${roomId}`,
      {
        headers: {
          'Cookie': cookie,
          'User-Agent': USER_AGENT,
          'Referer': 'https://www.douyu.com/',
          'Origin': '*',
        },
      },
    )
    if (data.error === 0 && data.data?.list?.length > 0) {
      const now = Math.floor(Date.now() / 1000)
      const list = data.data.list as DoubleCardApiItem[]
      const doubleCard = list.find(
        item => isActiveDoubleCard(item, now),
      )
      if (doubleCard) {
        return { active: true, expireTime: doubleCard.expireTime }
      }
    }
    return { active: false }
  } catch (error: unknown) {
    throw new Error(`检查房间${roomId}双倍卡失败: ${errorMessage(error)}`)
  }
}
