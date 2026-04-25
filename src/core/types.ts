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

export interface GiftStatus {
  count: number
  expireTime?: number
  error?: string
}

export type CookieCloudCryptoType = 'legacy'
export type DockerCookieSource = 'none' | 'manual' | 'cookieCloud' | 'hybrid'

export interface CookieCloudConfig {
  active?: boolean
  endpoint: string
  uuid: string
  password: string
  cron?: string
  cryptoType?: CookieCloudCryptoType
}

export interface ManualCookieConfig {
  main: string
  yuba: string
}

export interface CookieCloudCookie {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  hostOnly?: boolean
  sameSite?: string
  expirationDate?: number
}

export interface CookieDiagnostics {
  source: 'manual' | 'cookieCloud'
  mainCookieReady: boolean
  yubaCookieReady: boolean
  missingMainKeys: string[]
  missingYubaKeys: string[]
  cookieCount: number
  domains: string[]
  updateTime?: string
}

export interface EffectiveCookiePreview {
  source: DockerCookieSource
  mainCookie: string
  yubaCookie: string
  cookieCloudActive: boolean
  persistedLocally: boolean
}

export interface YubaFollowedGroup {
  groupId: number
  name: string
  unreadFeedNum: number
}

export interface YubaGroupHead {
  groupId: number
  groupName: string
  groupLevel: number
  groupExp: number
  nextLevelExp: number
  groupTitle: string
  rank: number
  isSigned: number
}

export interface YubaGroupStatus {
  groupId: number
  groupName: string
  unreadFeedNum: number
  groupLevel?: number
  groupExp?: number
  nextLevelExp?: number
  groupTitle?: string
  rank?: number
  isSigned?: number
  error?: string
}

export interface YubaCheckInResult {
  signedCount: number
  alreadySignedCount: number
  failedCount: number
  stoppedEarly: boolean
}

export interface FansStatusResponse {
  fans: FanStatus[]
  gift: GiftStatus
}

export interface YubaStatusResponse {
  groups: YubaGroupStatus[]
}

export interface SendGift {
  roomId: number
  number: number
  giftId: number
  weight: number
  count?: number
  percentage?: number
}

export type sendConfig = Record<string, SendGift>

export type ThemeMode = 'light' | 'dark' | 'system'
export type YubaCheckInMode = 'followed'

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
  manualCookies?: ManualCookieConfig
  cookieCloud?: CookieCloudConfig
  ui?: DockerUiConfig
  collectGift?: CollectGiftConfig
  keepalive?: JobConfig
  doubleCard?: DoubleCardConfig
  yubaCheckIn?: YubaCheckInConfig
}

export interface CollectGiftConfig {
  active?: boolean
  cron: string
}

export interface JobConfig {
  active?: boolean
  cron: string
  model: 1 | 2
  send: sendConfig
}

export interface DoubleCardConfig extends JobConfig {
  enabled?: Record<string, boolean>
}

export interface YubaCheckInConfig {
  active?: boolean
  cron: string
  mode?: YubaCheckInMode
}

export interface DockerUiConfig {
  themeMode?: ThemeMode
}

export interface DoubleCardInfo {
  active: boolean
  expireTime?: number
}

export type Logger = (message: string) => void
