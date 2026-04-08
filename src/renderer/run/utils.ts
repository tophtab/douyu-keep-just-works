import axios from 'axios'
import { computeGiftCountOfNumber, computeGiftCountOfPercentage } from '../../core/gift'
import type { Config, SendGift, sendArgs, sendConfig } from '../../core/types'

export type { Config, SendGift, sendArgs, sendConfig }
export { computeGiftCountOfNumber, computeGiftCountOfPercentage }

export async function getGiftNumber() {
  const { data } = await axios.get('https://www.douyu.com/japi/prop/backpack/web/v1?rid=4120796')
  if (data.data?.list?.length > 0) {
    return data.data?.list.find((item: any) => item.id === 268)?.count ?? 0
  } else {
    return 0
  }
}

export function sleep(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, time)
  })
}

export async function sendGift(args: sendArgs, Job: SendGift) {
  const data = new FormData()
  data.append('rid', String(Job.roomId))
  data.append('prop_id', String(Job.giftId))
  data.append('num', String(Job.count))
  data.append('sid', args.sid!)
  data.append('did', args.did!)
  data.append('dy', args.dy!)
  const res = await axios.post('https://www.douyu.com/member/prop/send', data)
  return JSON.stringify(res.data)
}

export async function getDyAndSid() {
  const data: sendArgs = await window.electron.ipcRenderer.invoke('getDyAndSid')
  return data
}

export async function getDid(roomid: string) {
  return new Promise<string>((resolve, reject) => {
    axios.get(`https://www.douyu.com/${roomid}`).then((res) => {
      const did1: string = res.data.match(/owner_uid =(.*?);/)?.[1]?.trim()
      const did2: string = res.data.match(/owner_uid:(.*?),/)?.[1]?.trim()
      if (did1 !== undefined) {
        resolve(did1)
      } else if (did2 !== undefined) {
        resolve(did2)
      } else {
        reject(new Error('获取did失败'))
      }
    })
  })
}

export async function getConfigByUser(user: string) {
  const cfg = await window.electron.ipcRenderer.invoke('db', {
    type: 'get',
    key: user,
  })
  try {
    return JSON.parse(cfg) as Config
  } catch (error) {
    throw new Error('当前用户配置不存在!')
  }
}

export async function getConfig() {
  const cfg = await window.electron.ipcRenderer.invoke('db', {
    type: 'get',
    key: 'config',
  })
  try {
    return JSON.parse(cfg) as Config
  } catch (error) {
    throw new Error('请先配置任务!')
  }
}
