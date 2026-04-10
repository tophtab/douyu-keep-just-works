export interface Fans {
  roomId: number
  name: string
  level: number
  rank: number
  intimacy: string
  today: number
}

export interface FanStatus extends Fans {
  doubleActive: boolean
  doubleExpireTime?: number
}

export interface SendGift {
  roomId: number
  number: number
  giftId: number
  percentage: number
  count?: number
}

export type sendConfig = Record<string, SendGift>

export interface Config {
  boot: boolean
  close: boolean
  type: '自动执行' | '定时执行' | '手动执行'
  time: '跟随执行模式' | '自定义'
  timeValue: (1 | 2 | 3 | 4 | 5 | 6 | 0)[]
  cron: string
  model: 1 | 2
  send: sendConfig
  doubleCardEnabled?: boolean
}

export interface sendArgs {
  sid?: string
  dy?: string
  did?: string
}

export interface DockerConfig {
  cookie: string
  keepalive?: JobConfig
  doubleCard?: JobConfig
}

export interface JobConfig {
  cron: string
  model: 1 | 2
  send: sendConfig
  time?: '跟随执行模式' | '自定义'
  timeValue?: (1 | 2 | 3 | 4 | 5 | 6 | 0)[]
}

export interface DoubleCardInfo {
  active: boolean
  expireTime?: number
}

export type Logger = (message: string) => void
