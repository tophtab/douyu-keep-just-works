import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { computeGiftCountOfNumber, computeGiftCountOfPercentage, getConfig, getDid, getDyAndSid, getGiftNumber, sendGift, sleep } from './utils'
import { checkDoubleCard } from '../../core/double-card'
import { computeGiftCountWithDoubleCard } from '../../core/gift'
import type { sendArgs, sendConfig } from '../../core/types'
import { useLog } from '~/stores'

const log = useLog()

const { text, runing } = storeToRefs(log)

export default async function startJob(manual: boolean) {
  if (runing.value) {
    text.value = '任务正在执行中...'
    return
  }
  const { type } = await getConfig()
  if (type === '自动执行' || manual) {
    await start()
  }
}

async function start() {
  runing.value = true
  text.value = '即将开始任务'
  let index = 0
  const timer = setInterval(() => {
    index++
    text.value = `正在领取荧光棒${index}秒...`
  }, 1000)
  try {
    await window.electron.ipcRenderer.invoke('getGift')
  } catch (error) {
    clearInterval(timer)
    text.value = `领取荧光棒失败${error}`
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }
  clearInterval(timer)
  text.value = '领取荧光棒成功'
  const { time, timeValue } = await getConfig()
  const dayOfWeek = dayjs().day() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  if (time === '自定义' && !timeValue.includes(dayOfWeek)) {
    text.value = '领取荧光棒成功, 但未满足赠送时机'
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }
  let number = 0
  try {
    number = await getGiftNumber()
  } catch (error) {
    text.value = `获取荧光棒数量失败${error}`
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }
  if (number === 0) {
    text.value = '荧光棒数量为0, 结束任务'
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }
  text.value = `荧光棒数量为${number}`
  sleep(2000)
  const { send, model, close, doubleCardEnabled } = await getConfig()
  let Jobs: sendConfig = {}

  try {
    if (doubleCardEnabled) {
      // Check all rooms for double card status
      const doubleCardRooms: Record<string, boolean> = {}
      for (const item of Object.values(send)) {
        const doubleInfo = await checkDoubleCard(item.roomId, '')
        doubleCardRooms[String(item.roomId)] = doubleInfo.active
        if (doubleInfo.active) {
          text.value = `房间${item.roomId}检测到双倍亲密度卡生效`
          await sleep(1000)
        }
      }
      Jobs = await computeGiftCountWithDoubleCard(number, send, doubleCardRooms, model)
      if (!Jobs) {
        text.value = '未检测到双倍卡，荧光棒已保留'
        setTimeout(() => {
          runing.value = false
        }, 10000)
        return
      }
    } else {
      if (model === 1) {
        Jobs = await computeGiftCountOfPercentage(number, send)
      } else if (model === 2) {
        Jobs = await computeGiftCountOfNumber(number, send)
      }
    }
  } catch (error: any) {
    text.value = error.toString()
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }

  text.value = '开始获取必要参数dy和sid'
  let args: sendArgs = {}
  try {
    args = await getDyAndSid()
  } catch (error) {
    text.value = `结束任务:获取参数失败${error}`
    setTimeout(() => {
      runing.value = false
    }, 10000)
    return
  }
  let faildNumber = 0
  for (const item of Object.values(Jobs)) {
    try {
      if (item.count === 0) {
        continue
      }

      text.value = `即将赠送${item.roomId}房间${item.count}个荧光棒`
      const did = await getDid(item.roomId.toString())
      args.did = did
      item.count = (item?.count ?? 0) + faildNumber
      await sendGift(args, item)
      faildNumber = 0
      text.value = `赠送${item.roomId}房间${item.count}个荧光棒成功`
    } catch (error) {
      faildNumber += item?.count ?? 0
      text.value = `${item.roomId}房间赠送失败${error}, ${item.count}个荧光棒自动移交给下一个房间`
    }
    await sleep(2000)
  }
  if (faildNumber > 0) {
    text.value = `任务执行完毕, 有${faildNumber}个荧光棒未赠送成功`
  } else {
    text.value = '任务执行完毕'
  }
  setTimeout(async () => {
    runing.value = false
    if (close) {
      window.electron.ipcRenderer.invoke('close')
    }
  }, 2000)
}
