import axios from 'axios'
import type { Fans, SendGift, sendArgs } from './types'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188'

function makeHeaders(cookie: string) {
  return {
    'Cookie': cookie,
    'User-Agent': USER_AGENT,
    'Referer': 'https://www.douyu.com/',
    'Origin': '*',
  }
}

export async function getGiftNumber(cookie: string): Promise<number> {
  const { data } = await axios.get('https://www.douyu.com/japi/prop/backpack/web/v1?rid=4120796', {
    headers: makeHeaders(cookie),
  })
  if (data.data?.list?.length > 0) {
    return data.data?.list.find((item: any) => item.id === 268)?.count ?? 0
  }
  return 0
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
  return JSON.stringify(res.data)
}

export async function getDid(roomId: string, cookie: string): Promise<string> {
  const res = await axios.get(`https://www.douyu.com/${roomId}`, {
    headers: makeHeaders(cookie),
  })
  const did1: string | undefined = res.data.match(/owner_uid =(.*?);/)?.[1]?.trim()
  const did2: string | undefined = res.data.match(/owner_uid:(.*?),/)?.[1]?.trim()
  if (did1 !== undefined) return did1
  if (did2 !== undefined) return did2
  throw new Error('获取did失败')
}

export async function getFansList(cookie: string): Promise<Fans[]> {
  const res = await axios.get('https://www.douyu.com/member/cp/getFansBadgeList', {
    headers: makeHeaders(cookie),
  })
  const table = res.data.match(/fans-badge-list">([\S\s]*?)<\/table>/)[1]
  const list = table.match(/<tr([\s\S]*?)<\/tr>/g)
  list?.shift()
  const fans: Fans[] = list?.map((item: any) => {
    const tds = item.match(/<td([\s\S]*?)<\/td>/g)
    return {
      name: String(item.match(/data-anchor_name="([\S\s]+?)"/)[1]),
      roomId: Number(item.match(/data-fans-room="(\d+)"/)[1]),
      level: Number(item.match(/data-fans-level="(\d+)"/)[1]),
      rank: Number(item.match(/data-fans-rank="(\d+)"/)[1]),
      intimacy: String(tds[2].replace(/<([\s\S]*?)>/g, '').trim()),
      today: Number(tds[3].replace(/<([\s\S]*?)>/g, '').trim()),
    }
  }) ?? []
  return fans.sort((a, b) => b.level - a.level)
}

export function parseDyAndSidFromCookie(cookie: string): sendArgs {
  const cookies = cookie.split(';').map(c => c.trim())
  let sid: string | undefined
  let dy: string | undefined
  for (const c of cookies) {
    const [name, value] = c.split('=')
    if (name.trim() === 'acf_uid') sid = value?.trim()
    if (name.trim() === 'dy_did') dy = value?.trim()
  }
  if (!sid || !dy) {
    throw new Error('Cookie中没有找到acf_uid(sid)和dy_did(dy)')
  }
  return { sid, dy }
}

export function sleep(time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time))
}
