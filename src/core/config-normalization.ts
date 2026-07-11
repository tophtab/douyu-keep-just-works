import { normalizeCookieCloudConfig } from './cookie-cloud'
import {
  DEFAULT_COLLECT_GIFT_CRON,
  DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_DOUBLE_CARD_MODEL,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_MODEL,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_GIFT_ID,
  DEFAULT_KEEPALIVE_CRON,
  DEFAULT_KEEPALIVE_MODEL,
  DEFAULT_THEME_MODE,
  DEFAULT_YUBA_CHECK_IN_CRON,
  DEFAULT_YUBA_CHECK_IN_MODE,
} from './task-defaults'
import type { CollectGiftConfig, CookieCloudConfig, DockerConfig, DoubleCardConfig, DoubleCardGiftScope, ExpiringGiftConfig, Fans, JobConfig, ManualCookieConfig, ManualPassportConfig, SendGift, YubaCheckInConfig, sendConfig } from './types'

function resolveTaskActive(active: boolean | undefined): boolean {
  return active !== false
}

function resolveWeight(item: Partial<SendGift> | undefined, fallback: number): number {
  if (typeof item?.weight === 'number' && Number.isFinite(item.weight)) {
    return item.weight
  }
  return fallback
}

interface SendRoomRef {
  key: string
  roomId: number
}

interface FanBackedTaskDefaults {
  active: boolean
  cron: string
  model: 1 | 2
  resolveMissingWeight?: (index: number) => number
}

const KEEPALIVE_TASK_DEFAULTS: FanBackedTaskDefaults = {
  active: true,
  cron: DEFAULT_KEEPALIVE_CRON,
  model: DEFAULT_KEEPALIVE_MODEL,
}

const DOUBLE_CARD_TASK_DEFAULTS: FanBackedTaskDefaults = {
  active: false,
  cron: DEFAULT_DOUBLE_CARD_CRON,
  model: DEFAULT_DOUBLE_CARD_MODEL,
}

const EXPIRING_GIFT_TASK_DEFAULTS: FanBackedTaskDefaults = {
  active: false,
  cron: DEFAULT_EXPIRING_GIFT_CRON,
  model: DEFAULT_EXPIRING_GIFT_MODEL,
  resolveMissingWeight: index => (index === 0 ? 1 : 0),
}

function createSendRoomRefsFromFans(fans: Fans[]): SendRoomRef[] {
  return fans.map(fan => ({
    key: String(fan.roomId),
    roomId: fan.roomId,
  }))
}

function createSendRoomRefsFromConfig(send: sendConfig | undefined): SendRoomRef[] {
  return Object.keys(send || {}).map(key => ({
    key,
    roomId: Number(key),
  }))
}

function normalizeSendItem(item: Partial<SendGift> | undefined, roomId: number, model: 1 | 2, weightFallback: number): SendGift {
  return {
    roomId,
    giftId: item?.giftId || DEFAULT_GIFT_ID,
    number: typeof item?.number === 'number' && Number.isFinite(item.number)
      ? item.number
      : (model === 2 ? 1 : 0),
    weight: model === 1 ? resolveWeight(item, weightFallback) : 0,
    count: typeof item?.count === 'number' && Number.isFinite(item.count) ? item.count : 0,
  }
}

function normalizeSendMap(
  send: sendConfig | undefined,
  rooms: SendRoomRef[],
  model: 1 | 2,
  resolveMissingWeight: (index: number) => number = () => 1,
): sendConfig {
  const next: sendConfig = {}

  rooms.forEach(({ key, roomId }, index) => {
    const item = send?.[key]
    const weightFallback = item ? 1 : resolveMissingWeight(index)
    next[key] = normalizeSendItem(item, roomId, model, weightFallback)
  })

  return next
}

function normalizeTaskModel(config: JobConfig): 1 | 2 {
  return config.model === 2 ? 2 : 1
}

function createDefaultFanBackedTaskConfig(fans: Fans[], defaults: FanBackedTaskDefaults): JobConfig {
  return {
    active: defaults.active,
    cron: defaults.cron,
    model: defaults.model,
    send: normalizeSendMap(undefined, createSendRoomRefsFromFans(fans), defaults.model, defaults.resolveMissingWeight),
  }
}

function normalizeFanBackedTaskConfig(config: JobConfig, defaults: FanBackedTaskDefaults): JobConfig {
  const model = normalizeTaskModel(config)
  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || defaults.cron,
    model,
    send: normalizeSendMap(config.send, createSendRoomRefsFromConfig(config.send), model),
  }
}

function reconcileFanBackedTaskConfig(config: JobConfig, fans: Fans[], defaults: FanBackedTaskDefaults): JobConfig {
  const model = normalizeTaskModel(config)
  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || defaults.cron,
    model,
    send: normalizeSendMap(config.send, createSendRoomRefsFromFans(fans), model, defaults.resolveMissingWeight),
  }
}

export function createDefaultCollectGiftConfig(): CollectGiftConfig {
  return {
    active: true,
    cron: DEFAULT_COLLECT_GIFT_CRON,
  }
}

function normalizeCollectGiftConfig(config: CollectGiftConfig | undefined): CollectGiftConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_COLLECT_GIFT_CRON,
  }
}

export function createDefaultYubaCheckInConfig(): YubaCheckInConfig {
  return {
    active: false,
    cron: DEFAULT_YUBA_CHECK_IN_CRON,
    mode: DEFAULT_YUBA_CHECK_IN_MODE,
  }
}

function normalizeYubaCheckInConfig(config: YubaCheckInConfig | undefined): YubaCheckInConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_YUBA_CHECK_IN_CRON,
    mode: config.mode || DEFAULT_YUBA_CHECK_IN_MODE,
  }
}

function normalizeCookieCloud(config: CookieCloudConfig | undefined): CookieCloudConfig | undefined {
  const normalized = normalizeCookieCloudConfig(config)
  if (!normalized) {
    return undefined
  }

  return {
    ...normalized,
    cron: normalized.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  }
}

function normalizeManualCookies(config: DockerConfig): ManualCookieConfig | undefined {
  const main = config.manualCookies?.main?.trim() || config.cookie || ''
  const yuba = config.manualCookies?.yuba?.trim() || ''

  if (!main && !yuba) {
    return undefined
  }

  return { main, yuba }
}

function normalizeManualPassport(config: DockerConfig): ManualPassportConfig | undefined {
  const passportCookie = config.manualPassport?.cookie?.trim() || ''

  if (!passportCookie) {
    return undefined
  }

  return { cookie: passportCookie }
}

export function createDefaultKeepaliveConfig(fans: Fans[]): JobConfig {
  return createDefaultFanBackedTaskConfig(fans, KEEPALIVE_TASK_DEFAULTS)
}

export function reconcileKeepaliveConfig(config: JobConfig | undefined, fans: Fans[]): JobConfig | undefined {
  if (!config) {
    return undefined
  }

  return reconcileFanBackedTaskConfig(config, fans, KEEPALIVE_TASK_DEFAULTS)
}

function buildEnabledMap(roomKeys: string[], config: DoubleCardConfig | undefined): Record<string, boolean> {
  const enabled: Record<string, boolean> = {}

  for (const key of roomKeys) {
    enabled[key] = Boolean(config?.enabled?.[key])
  }

  return enabled
}

function normalizeDoubleCardGiftScope(value: DoubleCardGiftScope | undefined): DoubleCardGiftScope {
  return value === 'limitedTime' ? 'limitedTime' : DEFAULT_DOUBLE_CARD_GIFT_SCOPE
}

export function createDefaultDoubleCardConfig(fans: Fans[]): DoubleCardConfig {
  const base = createDefaultFanBackedTaskConfig(fans, DOUBLE_CARD_TASK_DEFAULTS)
  return {
    ...base,
    active: false,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    enabled: buildEnabledMap(fans.map(fan => String(fan.roomId)), undefined),
  }
}

export function reconcileDoubleCardConfig(config: DoubleCardConfig | undefined, fans: Fans[]): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }

  const base = reconcileFanBackedTaskConfig(config, fans, DOUBLE_CARD_TASK_DEFAULTS)
  return {
    ...base,
    giftScope: normalizeDoubleCardGiftScope(config.giftScope),
    enabled: buildEnabledMap(fans.map(fan => String(fan.roomId)), config),
  }
}

export function createDefaultExpiringGiftConfig(fans: Fans[]): ExpiringGiftConfig {
  const base = createDefaultFanBackedTaskConfig(fans, EXPIRING_GIFT_TASK_DEFAULTS)
  return {
    ...base,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  }
}

export function reconcileExpiringGiftConfig(config: ExpiringGiftConfig | undefined, fans: Fans[]): ExpiringGiftConfig | undefined {
  if (!config) {
    return undefined
  }

  const base = reconcileFanBackedTaskConfig(config, fans, EXPIRING_GIFT_TASK_DEFAULTS)
  return {
    ...base,
    thresholdHours: normalizeThresholdHours(config.thresholdHours),
  }
}

function normalizeThresholdHours(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS
}

function normalizeKeepaliveConfig(config: JobConfig | undefined): JobConfig | undefined {
  if (!config) {
    return undefined
  }

  return normalizeFanBackedTaskConfig(config, KEEPALIVE_TASK_DEFAULTS)
}

function normalizeDoubleCardConfig(config: DoubleCardConfig | undefined): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }

  const base = normalizeFanBackedTaskConfig(config, DOUBLE_CARD_TASK_DEFAULTS)
  return {
    ...base,
    giftScope: normalizeDoubleCardGiftScope(config.giftScope),
    enabled: buildEnabledMap(Object.keys(base.send), config),
  }
}

function normalizeExpiringGiftConfig(config: ExpiringGiftConfig | undefined): ExpiringGiftConfig | undefined {
  if (!config) {
    return undefined
  }

  const base = normalizeFanBackedTaskConfig(config, EXPIRING_GIFT_TASK_DEFAULTS)
  return {
    ...base,
    thresholdHours: normalizeThresholdHours(config.thresholdHours),
  }
}

export function normalizeDockerConfig(config: DockerConfig, options: { ensureCollectGift?: boolean } = {}): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  const cookieCloud = normalizeCookieCloud(config.cookieCloud)
  const manualCookies = normalizeManualCookies(config)
  const manualPassport = normalizeManualPassport(config)
  const yubaCheckIn = normalizeYubaCheckInConfig(config.yubaCheckIn)
  return {
    cookie: manualCookies?.main || config.cookie || '',
    ...(manualCookies ? { manualCookies } : {}),
    ...(manualPassport ? { manualPassport } : {}),
    ...(cookieCloud ? { cookieCloud } : {}),
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift
      ? { collectGift }
      : (options.ensureCollectGift ? { collectGift: createDefaultCollectGiftConfig() } : {})),
    keepalive: normalizeKeepaliveConfig(config.keepalive),
    doubleCard: normalizeDoubleCardConfig(config.doubleCard),
    expiringGift: normalizeExpiringGiftConfig(config.expiringGift),
    ...(yubaCheckIn ? { yubaCheckIn } : {}),
  }
}

export function reconcileDockerConfig(config: DockerConfig, fans: Fans[]): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  const cookieCloud = normalizeCookieCloud(config.cookieCloud)
  const manualCookies = normalizeManualCookies(config)
  const manualPassport = normalizeManualPassport(config)
  const yubaCheckIn = normalizeYubaCheckInConfig(config.yubaCheckIn)
  return {
    cookie: manualCookies?.main || config.cookie,
    ...(manualCookies ? { manualCookies } : {}),
    ...(manualPassport ? { manualPassport } : {}),
    ...(cookieCloud ? { cookieCloud } : {}),
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift ? { collectGift } : {}),
    keepalive: reconcileKeepaliveConfig(config.keepalive, fans),
    doubleCard: reconcileDoubleCardConfig(config.doubleCard, fans),
    expiringGift: reconcileExpiringGiftConfig(config.expiringGift, fans),
    ...(yubaCheckIn ? { yubaCheckIn } : {}),
  }
}

export function createDefaultDockerConfig(): DockerConfig {
  return {
    cookie: '',
    ui: {
      themeMode: DEFAULT_THEME_MODE,
    },
    collectGift: createDefaultCollectGiftConfig(),
    keepalive: createDefaultKeepaliveConfig([]),
    expiringGift: createDefaultExpiringGiftConfig([]),
    yubaCheckIn: createDefaultYubaCheckInConfig(),
  }
}
