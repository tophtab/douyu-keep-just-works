export interface Fans {
  roomId: number
  name: string
  level: number
  rank: number
  intimacy: string
  today: number
}

export interface FanStatus extends Fans {
  doubleActive?: boolean
  doubleExpireTime?: number
}

export interface GiftStatus {
  count?: number
  expireTime?: number
  error?: string
  rows?: BackpackGiftRow[]
  totalRows?: number
}

export interface BackpackGiftRow {
  giftId: number
  name: string
  count: number
  expiry?: number
  expiryDays?: number
  expireTime?: number
  batchInfoPresent: boolean
  isValuable: boolean
  price: number
  intimacy: number
}

export interface BackpackStatus {
  rows: BackpackGiftRow[]
  totalRows: number
  glowStickCount: number
  glowStickExpireTime?: number
}

export interface ExpiringGiftSelection {
  candidates: BackpackGiftRow[]
  totalRows: number
  skippedNotExpiring: number
  skippedNoExpireTime: number
  skippedUnsafe: number
  budgetCount: number
  earliestExpireTime?: number
  giftCounts: Record<string, number>
  giftNames: Record<string, string>
}

export type CookieCloudCryptoType = 'legacy'
export type DockerCookieSource = 'none' | 'local' | 'cookieCloud' | 'hybrid'

export interface LoginCookiesConfig {
  passport: string
  main: string
  yuba: string
}

export interface LoginCookieValues {
  passportCookie: string
  mainCookie: string
  yubaCookie: string
}

export interface CookieCloudConfig {
  enabled: boolean
  endpoint: string
  uuid: string
  password: string
  cron: string
  cryptoType: CookieCloudCryptoType
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
  source: 'local' | 'cookieCloud'
  passport: {
    ltp0Present: boolean
  }
  main: {
    ready: boolean
    missingKeys: string[]
  }
  yuba: {
    dyTokenReady: boolean
    cookieReady: boolean
    missingDyTokenKeys: string[]
    missingCookieKeys: string[]
  }
  snapshot: {
    cookieCount: number
    domains: string[]
    updatedAt?: string
  }
}

export interface EffectiveCookiePreview {
  source: DockerCookieSource
  mainCookie: string
  yubaCookie: string
  cookieCloudEnabled: boolean
  persistedLocally: boolean
  passportLtp0Present?: boolean
}

export type PassportQrLoginStatus
  = | 'waiting'
    | 'scanned'
    | 'passport_confirmed'
    | 'main_saved'
    | 'yuba_saved'
    | 'yuba_failed'
    | 'expired'
    | 'cancelled'
    | 'failed'

export interface PassportQrLoginPublicStatus {
  sessionId: string
  status: PassportQrLoginStatus
  message: string
  expiresAt: number
  qrImageDataUrl?: string
  passportSaved: boolean
  mainSaved: boolean
  yubaSaved: boolean
  canRetryYuba: boolean
  finished: boolean
  error?: string
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
  complete?: boolean
  statusPhase?: 'list' | 'details'
}

export interface YubaStatusResponse {
  groups: YubaGroupStatus[]
}

export type AllocationMode = 'weighted' | 'fixed'

export interface WeightedRoomAllocation {
  weight: number
}

export interface FixedRoomAllocation {
  count: number
}

export interface WeightedAllocationConfig {
  allocationMode: 'weighted'
  roomAllocations: Record<string, WeightedRoomAllocation>
}

export interface FixedAllocationConfig {
  allocationMode: 'fixed'
  roomAllocations: Record<string, FixedRoomAllocation>
}

export type GiftAllocationConfig = WeightedAllocationConfig | FixedAllocationConfig

export interface GiftSendJob {
  roomId: number
  giftId: number
  count: number
}

export type GiftSendJobs = Record<string, GiftSendJob>

export type ThemeMode = 'light' | 'dark' | 'system'
export type YubaCheckInMode = 'followed'
export type DoubleCardGiftScope = 'glowStick' | 'limitedTime'

export interface SendGiftRequestArgs {
  sid?: string
  dy?: string
  did?: string
}

export interface ScheduledTaskConfig {
  enabled: boolean
  cron: string
}

export type JobConfig = ScheduledTaskConfig & GiftAllocationConfig

export type DoubleCardConfig = JobConfig & {
  giftScope: DoubleCardGiftScope
  participatingRoomIds: number[]
}

export type ExpiringGiftConfig = JobConfig & {
  thresholdHours: number
}

export interface CollectGiftConfig extends ScheduledTaskConfig {}

export interface YubaCheckInConfig extends ScheduledTaskConfig {
  mode: YubaCheckInMode
}

export interface DockerUiConfig {
  themeMode: ThemeMode
}

export interface DockerConfig {
  loginCookies: LoginCookiesConfig
  cookieCloud: CookieCloudConfig
  ui: DockerUiConfig
  pushChannel: PushChannelConfig
  pushReport: PushReportConfig
  collectGift: CollectGiftConfig
  keepalive: JobConfig
  doubleCard: DoubleCardConfig
  expiringGift: ExpiringGiftConfig
  yubaCheckIn: YubaCheckInConfig
}

/**
 * 推送渠道：自建 MagicPush 网关。留空时回退到 MAGICPUSH_URL / MAGICPUSH_TOKEN 环境变量。
 * mode=card 走飞书交互卡片，mode=text 走 markdown 文本。
 */
export interface PushChannelConfig {
  enabled: boolean
  baseUrl: string
  token: string
  mode: 'card' | 'text'
}

/**
 * 推送设置：每天固定时间把「所有已启用任务」当天的执行情况汇总成一张飞书卡片推出去。
 * 定时任务执行完不单独推送；手动触发的任务会即时推送单次结果。
 */
export interface PushReportConfig {
  enabled: boolean
  cron: string
}

/** 一次任务执行记录，用于汇总推送与 WebUI 展示 */
/** 单次送礼任务里某个房间的亲密度变化（任务前后各读一次粉丝牌得出） */
export interface TaskRunIntimacy {
  roomId: string
  /** 主播名，取粉丝牌列表里的名字 */
  name: string
  level: number
  /** 当前亲密度（intimacy 字段 "/" 前那段） */
  current: number
  /** 升级门槛（intimacy 字段 "/" 后那段） */
  threshold: number
  /** 本次任务带来的亲密度增量 */
  delta: number
  /** 本次任务是否发生了升级 */
  levelUp: boolean
}

export interface TaskRunRecord {
  type: string
  label: string
  startedAt: string
  finishedAt: string
  ok: boolean
  error?: string
  logs: string[]
  /** 送礼类任务的亲密度变化；非送礼任务或读取失败时缺省 */
  intimacy?: TaskRunIntimacy[]
}

/** 汇总推送里展示的登录态摘要 */
export interface CookieStatusSummary {
  source: 'local' | 'cookieCloud'
  /** LTP0（长效续期凭证）是否存在 */
  ltp0Present: boolean
  /** 主站登录字段是否齐全 */
  mainReady: boolean
  mainMissingKeys: string[]
  /** 鱼吧登录态是否齐全 */
  yubaReady: boolean
  yubaMissingKeys: string[]
  /** 快照内 cookie 条数 */
  cookieCount: number
  /** 登录快照更新时间（配置文件 mtime） */
  updatedAt?: string
  /** 读取失败时的原因 */
  error?: string
}

/** 推送设置页的实时数据 */
export interface PushReportSnapshot {
  enabled: boolean
  cron: string
  configured: boolean
  nextRun?: string
  cookie: CookieStatusSummary
  channel: {
    enabled: boolean
    baseUrl: string
    mode: 'card' | 'text'
    tokenSet: boolean
    tokenPreview: string
    /** 生效来源：config 表示界面里配的，env 表示环境变量，disabled 表示已在界面显式关闭 */
    source: 'config' | 'env' | 'none' | 'disabled'
  }
  tasks: Array<{
    type: string
    label: string
    enabled: boolean
    cron: string
    lastRun?: TaskRunRecord
  }>
}

export interface DoubleCardInfo {
  active: boolean
  expireTime?: number
}

export type Logger = (message: string) => void
