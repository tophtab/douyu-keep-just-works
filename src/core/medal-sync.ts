import { normalizeCookieCloudConfig } from './cookie-cloud'
import type { CollectGiftConfig, CookieCloudConfig, DockerConfig, DoubleCardConfig, Fans, JobConfig, ManualCookieConfig, SendGift, ThemeMode, YubaCheckInConfig, sendConfig } from './types'

const DEFAULT_COLLECT_GIFT_CRON = '0 10 0,1 * * *'
const DEFAULT_KEEPALIVE_CRON = '0 0 8 */6 * *'
const DEFAULT_DOUBLE_CARD_CRON = '0 20 14,17,20,23 * * *'
const DEFAULT_YUBA_CHECK_IN_CRON = '0 23 0 * * *'
const DEFAULT_COOKIE_CLOUD_SYNC_CRON = '0 5 0 * * *'
const DEFAULT_THEME_MODE: ThemeMode = 'system'
const DEFAULT_GIFT_ID = 268

function resolveTaskActive(active: boolean | undefined): boolean {
  return active !== false
}

function resolveWeight(item: Partial<SendGift> | undefined, fallback: number): number {
  if (typeof item?.weight === 'number' && Number.isFinite(item.weight)) {
    return item.weight
  }
  if (typeof item?.percentage === 'number' && Number.isFinite(item.percentage)) {
    return item.percentage
  }
  return fallback
}

function createDefaultSendItem(roomId: number, model: 1 | 2): SendGift {
  return {
    roomId,
    giftId: DEFAULT_GIFT_ID,
    number: model === 2 ? 1 : 0,
    weight: model === 1 ? 1 : 0,
    count: 0,
  }
}

function normalizeSendItem(item: Partial<SendGift> | undefined, roomId: number, model: 1 | 2): SendGift {
  return {
    roomId,
    giftId: item?.giftId || DEFAULT_GIFT_ID,
    number: typeof item?.number === 'number' && Number.isFinite(item.number)
      ? item.number
      : (model === 2 ? 1 : 0),
    weight: model === 1 ? resolveWeight(item, 1) : 0,
    count: typeof item?.count === 'number' && Number.isFinite(item.count) ? item.count : 0,
  }
}

function mergeSendConfig(send: sendConfig | undefined, fans: Fans[], model: 1 | 2): sendConfig {
  const next: sendConfig = {}

  for (const fan of fans) {
    const key = String(fan.roomId)
    next[key] = send?.[key]
      ? normalizeSendItem(send[key], fan.roomId, model)
      : createDefaultSendItem(fan.roomId, model)
  }

  return next
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
    mode: 'followed',
  }
}

function normalizeYubaCheckInConfig(config: YubaCheckInConfig | undefined): YubaCheckInConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_YUBA_CHECK_IN_CRON,
    mode: config.mode || 'followed',
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

export function createDefaultKeepaliveConfig(fans: Fans[]): JobConfig {
  return {
    active: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    model: 2,
    send: mergeSendConfig(undefined, fans, 2),
  }
}

export function reconcileKeepaliveConfig(config: JobConfig | undefined, fans: Fans[]): JobConfig | undefined {
  if (!config) {
    return undefined
  }

  const model = config.model === 2 ? 2 : 1
  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_KEEPALIVE_CRON,
    model,
    send: mergeSendConfig(config.send, fans, model),
  }
}

function buildEnabledMap(roomKeys: string[], config: DoubleCardConfig | undefined): Record<string, boolean> {
  const enabled: Record<string, boolean> = {}

  for (const key of roomKeys) {
    if (config?.enabled && key in config.enabled) {
      enabled[key] = Boolean(config.enabled[key])
      continue
    }

    // Migration path: old configs only stored selected rooms in send.
    enabled[key] = Boolean(config?.send?.[key])
  }

  return enabled
}

export function createDefaultDoubleCardConfig(fans: Fans[]): DoubleCardConfig {
  return {
    active: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    model: 1,
    send: mergeSendConfig(undefined, fans, 1),
    enabled: buildEnabledMap(fans.map(fan => String(fan.roomId)), undefined),
  }
}

export function reconcileDoubleCardConfig(config: DoubleCardConfig | undefined, fans: Fans[]): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }

  const model = config.model === 2 ? 2 : 1
  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_DOUBLE_CARD_CRON,
    model,
    send: mergeSendConfig(config.send, fans, model),
    enabled: buildEnabledMap(fans.map(fan => String(fan.roomId)), config),
  }
}

function normalizeKeepaliveConfig(config: JobConfig | undefined): JobConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_KEEPALIVE_CRON,
    model: config.model === 2 ? 2 : 1,
    send: Object.entries(config.send || {}).reduce((acc, [key, item]) => {
      acc[key] = normalizeSendItem(item, Number(key), config.model === 2 ? 2 : 1)
      return acc
    }, {} as sendConfig),
  }
}

function normalizeDoubleCardConfig(config: DoubleCardConfig | undefined): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }

  const model = config.model === 2 ? 2 : 1
  const send = Object.entries(config.send || {}).reduce((acc, [key, item]) => {
    acc[key] = normalizeSendItem(item, Number(key), model)
    return acc
  }, {} as sendConfig)
  return {
    active: resolveTaskActive(config.active),
    cron: config.cron || DEFAULT_DOUBLE_CARD_CRON,
    model,
    send,
    enabled: buildEnabledMap(Object.keys(send), config),
  }
}

export function normalizeDockerConfig(config: DockerConfig, options: { ensureCollectGift?: boolean } = {}): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  const cookieCloud = normalizeCookieCloud(config.cookieCloud)
  const manualCookies = normalizeManualCookies(config)
  const yubaCheckIn = normalizeYubaCheckInConfig(config.yubaCheckIn)
  return {
    cookie: manualCookies?.main || config.cookie || '',
    ...(manualCookies ? { manualCookies } : {}),
    ...(cookieCloud ? { cookieCloud } : {}),
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift
      ? { collectGift }
      : (options.ensureCollectGift ? { collectGift: createDefaultCollectGiftConfig() } : {})),
    keepalive: normalizeKeepaliveConfig(config.keepalive),
    doubleCard: normalizeDoubleCardConfig(config.doubleCard),
    ...(yubaCheckIn ? { yubaCheckIn } : {}),
  }
}

export function reconcileDockerConfig(config: DockerConfig, fans: Fans[]): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  const cookieCloud = normalizeCookieCloud(config.cookieCloud)
  const manualCookies = normalizeManualCookies(config)
  const yubaCheckIn = normalizeYubaCheckInConfig(config.yubaCheckIn)
  return {
    cookie: manualCookies?.main || config.cookie,
    ...(manualCookies ? { manualCookies } : {}),
    ...(cookieCloud ? { cookieCloud } : {}),
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift ? { collectGift } : {}),
    keepalive: reconcileKeepaliveConfig(config.keepalive, fans),
    doubleCard: reconcileDoubleCardConfig(config.doubleCard, fans),
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
    yubaCheckIn: createDefaultYubaCheckInConfig(),
  }
}
