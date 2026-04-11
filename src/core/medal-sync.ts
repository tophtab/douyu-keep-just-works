import type { CollectGiftConfig, DockerConfig, DoubleCardConfig, Fans, JobConfig, SendGift, ThemeMode, sendConfig } from './types'

const DEFAULT_COLLECT_GIFT_CRON = '0 10 0,1 * * *'
const DEFAULT_KEEPALIVE_CRON = '0 0 8 */6 * *'
const DEFAULT_DOUBLE_CARD_CRON = '0 0 14,16,20 * * *'
const DEFAULT_THEME_MODE: ThemeMode = 'system'
const DEFAULT_GIFT_ID = 268

function createDefaultSendItem(roomId: number, model: 1 | 2): SendGift {
  return {
    roomId,
    giftId: DEFAULT_GIFT_ID,
    number: model === 2 ? 1 : 0,
    percentage: model === 1 ? 1 : 0,
    count: 0,
  }
}

function mergeSendConfig(send: sendConfig | undefined, fans: Fans[], model: 1 | 2): sendConfig {
  const next: sendConfig = {}

  for (const fan of fans) {
    const key = String(fan.roomId)
    next[key] = send?.[key]
      ? { ...send[key] }
      : createDefaultSendItem(fan.roomId, model)
  }

  return next
}

export function createDefaultCollectGiftConfig(): CollectGiftConfig {
  return {
    cron: DEFAULT_COLLECT_GIFT_CRON,
  }
}

function normalizeCollectGiftConfig(config: CollectGiftConfig | undefined): CollectGiftConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    cron: config.cron || DEFAULT_COLLECT_GIFT_CRON,
  }
}

export function createDefaultKeepaliveConfig(fans: Fans[]): JobConfig {
  return {
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
    cron: config.cron || DEFAULT_KEEPALIVE_CRON,
    model: config.model === 2 ? 2 : 1,
    send: { ...(config.send || {}) },
  }
}

function normalizeDoubleCardConfig(config: DoubleCardConfig | undefined): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }

  const send = { ...(config.send || {}) }
  return {
    cron: config.cron || DEFAULT_DOUBLE_CARD_CRON,
    model: config.model === 2 ? 2 : 1,
    send,
    enabled: buildEnabledMap(Object.keys(send), config),
  }
}

export function normalizeDockerConfig(config: DockerConfig, options: { ensureCollectGift?: boolean } = {}): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  return {
    cookie: config.cookie || '',
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift
      ? { collectGift }
      : (options.ensureCollectGift ? { collectGift: createDefaultCollectGiftConfig() } : {})),
    keepalive: normalizeKeepaliveConfig(config.keepalive),
    doubleCard: normalizeDoubleCardConfig(config.doubleCard),
  }
}

export function reconcileDockerConfig(config: DockerConfig, fans: Fans[]): DockerConfig {
  const collectGift = normalizeCollectGiftConfig(config.collectGift)
  return {
    cookie: config.cookie,
    ui: {
      themeMode: config.ui?.themeMode || DEFAULT_THEME_MODE,
    },
    ...(collectGift ? { collectGift } : {}),
    keepalive: reconcileKeepaliveConfig(config.keepalive, fans),
    doubleCard: reconcileDoubleCardConfig(config.doubleCard, fans),
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
  }
}
