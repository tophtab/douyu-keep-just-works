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
  collectGift: CollectGiftConfig
  keepalive: JobConfig
  doubleCard: DoubleCardConfig
  expiringGift: ExpiringGiftConfig
  yubaCheckIn: YubaCheckInConfig
}

export interface DoubleCardInfo {
  active: boolean
  expireTime?: number
}

export type Logger = (message: string) => void
